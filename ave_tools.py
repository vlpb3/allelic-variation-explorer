import argparse
import itertools
import time
import os
from pybedtools import BedTool as bt


def import_annotations(gff_files):
    """Read in annotation files and import into db.
    """
    # chunkSize = 128


def import_data(args):
    """Import data into a database.
    """
    import_annotations(args.annot)


def featuretype_filter(feature, featuretype):
    if feature[2] == featuretype:
        return True
    return False


def reset(fhs):
    for fh in fhs:
        fh.seek(0)


def snps_by_location(args):
    """
    Group SNPs by their location.
    """
    t0 = time.time()
    
    annotations = bt(itertools.chain(*args.annot)).saveas().fn
    # group features by type
    features_by_type = {}
    featuretypes = ['gene', 'exon', 'five_prime_UTR', 'three_prime_UTR']
    for featuretype in featuretypes:
        features_by_type[featuretype] = annotations.filter(featuretype_filter,
                featuretype).saveas().fn
        reset(args.annot)
    genes, exons = features_by_type['gene'], features_by_type['exon']
    introns = bt(genes).subtract(bt(exons)).sort().merge().remove_invalid()
    features_by_type['intron'] = introns.saveas().fn

    # group snps by feature overlap
    snps_by_location = {}
    for featuretype in features_by_type.keys():
        snps = bt(itertools.chain(*args.snps))
        snps_in_location = bt(features_by_type[featuretype]).intersect(
                snps, u=True)
        reset(args.snps)
        snps_by_location[featuretype] = snps_in_location
    # save features as gff files
    data_dir = os.path.dirname(args.snps[0].name)
    for loc in snps_by_location.keys():
        fname = os.path.join(data_dir, loc + "_snps.gff")
        bt(snps_by_location[loc]).saveas(fname)
    t1 = time.time()
    print(t1 - t0)


def main():
    # parse script arguments
    general_description = 'Usefull tools for Allelic Variation Explorer'
    parser = argparse.ArgumentParser(description=general_description)

    subparsers = parser.add_subparsers(title='tools',
            description='available ave tools')

    # subparser for import tool
    import_parser = subparsers.add_parser('import',
            help='importing data to ave db')
    import_parser.add_argument('--genome', type=str,
            help='name of the genome')
    import_parser.add_argument('--ref', nargs='*', type=argparse.FileType('r'),
            help='reference sequnce in fasta format')
    import_parser.add_argument('--annot', nargs='*',
            type=argparse.FileType('r'),
            help='annatations in gff3 format')
    import_parser.set_defaults(func=import_data)

    # subparser for snp annotation by location
    group_snps_parser = subparsers.add_parser('group_snps_by_loc',
            help='group SNPs by location according to annotations')
    group_snps_parser.add_argument('--annot', nargs='*',
            type=argparse.FileType('r'),
            help='gene models annotations in gff format')
    group_snps_parser.add_argument('--snps', nargs='*',
            type=argparse.FileType('r'),
            help='snp annotations in gff format')
    group_snps_parser.set_defaults(func=snps_by_location)

    args = parser.parse_args()
    args.func(args)

if __name__ == '__main__':
    main()
