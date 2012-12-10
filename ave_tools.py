import argparse
import time
import sys
import os
import multiprocessing
import pymongo
import logging
import pybedtools
from pybedtools import BedTool as bt
from pymongo import Connection
from Bio import SeqIO
from itertools import islice, chain, repeat
from json import JSONDecoder as jd
import Colorer


def chunks(l, n):
    """
    Divide a list l into a list of n-size lists.
    """
    return [l[i: i + n] for i in range(0, len(l), n)]


def ichunked(seq, chunksize):
    """Yields items from an iterator in iterable chunks."""
    it = iter(seq)
    while True:
        yield chain([it.next()], islice(it, chunksize - 1))


def parse_annotations(f, genome):
    """
    Parse the annotations and write them into the db.
    """
    feat = bt(f)
    logging.info('processing: %s' % f.name)
    chunk_size = 1024
    con = Connection()
    seqdb = con['seqdb']
    features = seqdb.features
    strains = seqdb.genomestrains
    small_feature_chunks = ichunked(feat, chunk_size)
    try:
        for chunk in small_feature_chunks:
            feature_list = []
            strain_list = []
            for a in chunk:
                feature = {
                    'seqid': a[0],
                    'source': a[1],
                    'type': a[2],
                    'start': int(a[3]),
                    'end': int(a[4]),
                    'score': a[5],
                    'strand': a[6],
                    'phase': a[7],
                    'attributes': a.attrs
                }
                feature['attributes']['genome'] = genome
                feature_list.append(feature)
                try:
                    strain = feature['attributes']['Strain']
                    strain_list.append(strain)
                except:
                    pass
            strain_list = list(set(strain_list))
            strains.update(
                {'genome': genome},
                {'$addToSet': {'strains': {'$each': strain_list}}}
            )
            features.insert(feature_list, safe=True)
    except pybedtools.cbedtools.MalformedBedLineError:
        logging.error("Gff file is not formated corectly, please validate it!")
        sys.exit(0)
    logging.info('finished processing file')
    return


# @profile
def import_annotations(annot, genome):
    """Read in annotation files and import into db.
    """
    logging.info("processing annotations")
    t0 = time.time()
    conn = Connection()
    seqdb = conn.seqdb
    seqdb.genomestrains.insert({'genome': genome})
    for f in annot:
        parse_annotations(f, genome)
    t1 = time.time()
    t = t1 - t0
    logging.info("time elapsed: %d" % t)


def import_ref_seq(ref, genome):
    """
    Import reference seqence from fasta files.
    """
    chunk_size = 1000000

    # connect to the database collection
    con = Connection()
    seqdb = con['seqdb']
    refseqs = seqdb.refseqs
    for fin in ref:
        fasta = SeqIO.parse(fin, 'fasta')
        for seq in fasta:
            seq_len = len(seq)
            chrom = seq.id
            logging.info('processing sequence from: ' + chrom)
            startlist = islice(xrange(seq_len), 1, None, chunk_size)
            endlist = islice(xrange(seq_len), chunk_size, None, chunk_size)
            if ((seq_len % chunk_size) > 0):
                endlist = chain(endlist, [seq_len, ])
            seq_in_chunks = chunks(seq.seq.tostring(), chunk_size)
            for chunk, start, end in zip(seq_in_chunks, startlist, endlist):
                refseq = {}
                refseq['genome'] = genome
                refseq['chrom'] = chrom
                refseq['starts'] = int(start)
                refseq['ends'] = int(end)
                refseq['sequence'] = chunk
                refseqs.insert(refseq, safe=True)


def make_indexes():
    con = Connection()
    seqdb = con['seqdb']
    features = seqdb.features
    refseqs = seqdb.refseqs
    logging.info('indexing features')
    features.create_index([
        ('attributes.genome', pymongo.ASCENDING),
        ('type', pymongo.ASCENDING),
        ('seqid', pymongo.ASCENDING),
        ('start', pymongo.ASCENDING),
        ('end', pymongo.ASCENDING)])
    seqdb.features.create_index([
        ('attributes.genome', pymongo.ASCENDING),
        ('attributes.Name', pymongo.ASCENDING)])
    logging.info('indexing reference sequence')
    refseqs.create_index([
        ('chrom', pymongo.ASCENDING),
        ('starts', pymongo.ASCENDING),
        ('ends', pymongo.ASCENDING)])


def parse_chromInfo(args):
    """Parse file storing information about chromosome sizes.
    """
    lines = args.chromInfo.readlines()
    chromInfo = {l.split(" ")[0]: int(l.split(" ")[1]) for l in lines}
    return chromInfo


def parse_config(args):
    """Parse json config file.
    """
    decode = jd().decode
    json_string = args.config.read()
    jargs = decode(json_string)
    args.chromInfo = open(jargs['chromInfo'], 'r')
    args.genome = jargs['genome']
    # open annotation files and put into args
    args.annot = [open(f, 'r') for f in jargs['annot']]
    args.ref = [open(f, 'r') for f in jargs['ref']]
    return args


def check_chroms(args, chromInfo):
    """
    Check for consistency in chromosome naming.
    """
    logging.info("Checking for consistency of chromosome ids:")
    # extract chromosome ids from chromInfo
    chromInfo_chromset = set(chromInfo.keys())
    # extract chromosome ids from fasta files
    ref_chromset = set([])
    for fin in args.ref:
        fasta = SeqIO.parse(fin.name, 'fasta')
        for seq in fasta:
            ref_chromset.add(seq.id)
    # extract chromosome ids from features in gff files
    annot_chromset = set([])
    for fin in args.annot:
        for line in open(fin.name, 'r').readlines():
            annot_chromset.add(line.strip().split("\t")[0])

    # compare all chromsets
    in_chromInfo_not_ref = chromInfo_chromset - ref_chromset
    in_chromInfo_not_annot = chromInfo_chromset - annot_chromset
    in_ref_not_chromInfo = ref_chromset - chromInfo_chromset
    in_annot_not_chromInfo = annot_chromset - chromInfo_chromset
    all_right = True
    if (len(in_chromInfo_not_ref) > 0):
        all_right = False
        chroms_str = ", ".join(in_chromInfo_not_ref)
        logging.warning('%s present in chromInfo but not in reference',
                        chroms_str)
    if (len(in_chromInfo_not_annot) > 0):
        all_right = False
        chroms_str = ", ".join(in_chromInfo_not_annot)
        logging.warning('%s present in chromInfo but not in annotations',
                        chroms_str)
    if (len(in_ref_not_chromInfo) > 0):
        all_right = False
        chroms_str = ". ".join(in_ref_not_chromInfo)
        logging.warning('%s present in reference but not in chromInfo',
                        chroms_str)
    if (len(in_annot_not_chromInfo) > 0):
        all_right = False
        chroms_str = ". ".join(in_annot_not_chromInfo)
        logging.warning('%s present in annotations but not in chromInfo',
                        chroms_str)

    if all_right:
        logging.info("Chromosome intendifiers are all right.")
    else:
        logging.error("Chromosome identifiers don't match.")
        qu = "Do you wont to countinue imports? [y/N]"
        do_continue = True if raw_input(qu).lower() == 'y' else False
        if not do_continue:
            logging.error("Canceling imports.")
            sys.exit(0)


def import_chromInfo(args, chromInfo):
    """Import chromosome sizes from chromInfo into mongodb.
    """
    con = Connection()
    seqdb = con['seqdb']
    chromInfo_collection = seqdb.chromInfo
    chromInfo_doc = {'genome': args.genome,
                     'chromosomes': chromInfo}
    print(chromInfo_doc)
    chromInfo_collection.insert(chromInfo_doc, safe=True)


def import_data(args):
    """Import data into a database.
    """
    # if the arguments are in a config file
    # parse this config file first
    # ans supply proper args
    if (args.config):
        args = parse_config(args)
    chromInfo = parse_chromInfo(args)
    check_chroms(args, chromInfo)
    import_chromInfo(args, chromInfo)
    # import_annotations(args.annot, args.genome)
    # import_ref_seq(args.ref, args.genome)
    # make_indexes()
    logging.info('Successfully finished imports')


def featuretype_filter(feature, featuretype):
    if feature[2] == featuretype:
        return True
    return False


def reset(fhs):
    for fh in fhs:
        fh.seek(0)


def annotate_location(snp, loc):
    """
    Annotate snp by putting variant_location in attributes.
    """
    snp.attrs['variant_location'] = loc
    return snp


def subset_features((featuretype, annotations)):
    a = bt(annotations)
    features_of_type = a.filter(featuretype_filter,
                                featuretype).saveas().fn
    logging.info("subsetting features in " + featuretype)
    return ((featuretype, features_of_type))


def subset_snps((featuretype, features, snps)):
    s = bt(snps)
    snps_in_location = s.intersect(bt(features[featuretype]),
                                   u=True).saveas().fn
    logging.info("subsetting snps in " + featuretype)
    return((featuretype, snps_in_location))


def annotate_snps(((loc, snps), data_dir)):
    annotated_snps = bt(snps).each(annotate_location, loc)
    fname = os.path.join(data_dir, loc + "_snps.gff")
    annotated_snps.saveas(fname)


def snps_by_location(args):
    """
    Group SNPs by their location.
    """
    t0 = time.time()

    # save annotations and snps as single temp bedtools files
    annotations = bt(chain(*args.annot)).saveas().fn
    snps = bt(chain(*args.snps)).saveas().fn

    # group features by type
    featuretypes = ['gene', 'CDS', 'exon', 'five_prime_UTR', 'three_prime_UTR']
    # use multiprocessing to subset each type in sepatate thread
    pool = multiprocessing.Pool(len(featuretypes))
    annotation_list = repeat(annotations, times=len(featuretypes))
    results = pool.map(subset_features, zip(featuretypes, annotation_list))
    features_by_type = {ftype: feature for (ftype, feature) in results}

    # create intron intervals
    genes, exons = features_by_type['gene'], features_by_type['exon']
    introns = bt(genes).subtract(bt(exons)).sort().merge().remove_invalid()
    features_by_type['intron'] = introns.saveas().fn

    # after getting introns, exons are not needed any more, we'll use CDSs
    del features_by_type['exon']

    # group snps by feature overlap
    pool_size = len(features_by_type.keys())
    pool = multiprocessing.Pool(pool_size)
    snps_list = [snps for i in range(pool_size)]
    features_list = repeat(features_by_type, times=pool_size)
    results = pool.map(subset_snps, zip(features_by_type.keys(),
                       features_list, snps_list))
    snps_by_location = {ftype: feature for (ftype, feature) in results}

    # find intergenic snps
    s = bt(snps)
    genes = bt(features_by_type['gene'])
    intergenic = s.intersect(bt(genes), v=True).saveas().fn
    snps_by_location['intergenic'] = intergenic
    # anntoate snps and save them as gff files
    data_dir = os.path.dirname(args.snps[0].name)

    # remove 'gene' snps, they're not needed anymore
    del snps_by_location['gene']

    # remove duplicate SNPs
    intronic = bt(snps_by_location['intron'])
    cdss = bt(snps_by_location['CDS'])
    utr5s = bt(snps_by_location['five_prime_UTR'])
    utr3s = bt(snps_by_location['three_prime_UTR'])
    intronic = intronic.intersect(cdss, v=True)
    intronic = intronic.intersect(utr5s, v=True)
    intronic = intronic.intersect(utr3s, v=True)
    snps_by_location['intron'] = intronic.saveas().fn
    utr5s = utr5s.intersect(cdss, v=True)
    snps_by_location['five_prime_UTR'] = utr5s.saveas().fn
    utr3s = utr3s.intersect(cdss, v=True)
    snps_by_location['three_prime_UTR'] = utr3s.saveas().fn

    # annotate snps
    pool_size = len(snps_by_location.keys())
    pool = multiprocessing.Pool(pool_size)
    dd_list = repeat(data_dir, times=pool_size)
    pool.map(annotate_snps, zip(snps_by_location.items(), dd_list))

    t1 = time.time()
    t = t1 - t0
    logging.info("time elapsed: %d" % t)


def main():
    # setup logger
    formater = '%(asctime)s:\n%(message)s'
    logging.basicConfig(format=formater, level=logging.DEBUG)

    # parse script arguments
    general_description = 'Usefull tools for Allelic Variation Explorer'
    parser = argparse.ArgumentParser(description=general_description)

    subparsers = parser.add_subparsers(title='tools',
                                       description='available ave tools')

    # subparser for import tool
    import_parser = subparsers.add_parser(
        'import', help='importing data to ave db')
    import_parser.add_argument(
        '--chromInfo', type=argparse.FileType('r'))
    import_parser.add_argument(
        '--config', type=argparse.FileType('r'))
    import_parser.add_argument(
        '--genome', type=str, help='name of the genome')
    import_parser.add_argument(
        '--ref', nargs='*', type=argparse.FileType('r'),
        help='reference sequnce in fasta format')
    import_parser.add_argument(
        '--annot', nargs='*',
        type=argparse.FileType('r'),
        help='annotations in gff3 format')
    import_parser.set_defaults(func=import_data)

    # subparser for snp annotation by location
    group_snps_parser = subparsers.add_parser(
        'group_snps_by_loc',
        help='group SNPs by location according to annotations')
    group_snps_parser.add_argument(
        '--annot', nargs='*',
        type=argparse.FileType('r'),
        help='gene models annotations in gff format')
    group_snps_parser.add_argument(
        '--snps', nargs='*',
        type=argparse.FileType('r'),
        help='snp annotations in gff format')
    group_snps_parser.set_defaults(func=snps_by_location)

    args = parser.parse_args()
    args.func(args)


if __name__ == '__main__':
    main()
