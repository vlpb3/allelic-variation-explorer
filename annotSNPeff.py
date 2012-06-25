import sys
import argparse
import itertools
from pymongo import Connection
from pymongo.errors import ConnectionFailure
from BCBio import GFF
from Bio import SeqIO
from Bio.Alphabet import IUPAC


def connect(db):
    """ Connect ot hte db.

    Return database connection handle.

    """
    # default db port
    port = 27017
    try:
        con = Connection(host="localhost", port=port)
    except ConnectionFailure, e:
        sys.stderr.write("Could not connect to db: %s" % e)
        sys.exit(1)
    dbh = con[db]
    return dbh


def annotSNPeff(annotated_sequence, genome, dbh):
    """ Annotate SNP effect using gene annotations.

    Use annotated sequence -- an iterator over gff annotations with
    sequence attached to them.
    """
    # loop over chromosomes
    for chrom in annotated_sequence:
        # loop over features in a chromosome
        genes = filter(lambda feature: feature.type == 'gene', chrom.features)
        for gene in genes:
            # print out info about processed gene
            print('processing: %s' % gene.id)
            # get position of the gene
            start = int(gene.location.start)
            end = int(gene.location.end)
            mRNAs = gene.sub_features
            # flatten all the features into a single list
            mRNAfeatures = list(itertools.chain(
                *[mrna.sub_features for mrna in mRNAs]))
            # fetch all SNPs in this gene
            snp_query = {
                   'attributes.genome': genome,
                   'type': {'$regex': '^SNP'},
                   'seqid': chrom.id,
                   'start': {'$gte': start},
                   'end': {'$lte': end}}
            snps = dbh.features.find(snp_query)
            # assign snp to one of the groups,
            # depending on where the snp is located
            # by using sets we avoid duplicates
            regions = {
                    'five_prime_UTR': set(),
                    'three_prime_UTR': set(),
                    'CDS': set()}
            for snp in snps:
                for feature in mRNAfeatures:
                    if ((snp['start'] in feature)
                            and (feature.type in regions.keys())):
                        regions[feature.type].add(snp['_id'])
            # annotate those in utrs
            dbh.features.update(
                    {'_id': {'$in': list(regions['five_prime_UTR'])}},
                    {'$set':
                        {'attributes.variation.location': 'five_prime_UTR'}},
                    safe=True)

            dbh.features.update(
                    {'_id': {'$in': list(regions['three_prime_UTR'])}},
                    {'$set':
                        {'attributes.variation.location': 'three_prime_UTR'}},
                    safe=True)

            # annotate snps in CDSs
            dbh.features.update(
                {'_id': {'$in': list(regions['CDS'])}},
                {'$set':
                    {'attributes.variation.location': 'CDS'}})
            # annotate intronic SNPs
            exonic = regions['CDS'].union(
                    regions['five_prime_UTR'], regions['three_prime_UTR'])
            intronic = []
            snps.rewind()
            for snp in snps:
                if snp['_id'] not in exonic:
                    intronic.append(snp['_id'])
            dbh.features.update(
                    {'_id': {'$in': intronic}},
                    {'$set':
                        {'attributes.variation.location': 'intronic'}})


def import_annotated_sequence(fasta_file, gff_file):
    """ Return annotated sequence.

    Parse fasta file with reference sequence.
    Parse gff file and attach sequence iformation to it.
    """
    # import sequence as dictionary
    seq_handle = open(fasta_file)
    seq_dict = SeqIO.to_dict(
            SeqIO.parse(seq_handle, 'fasta', IUPAC.ambiguous_dna))
    seq_handle.close()

    # import annotations and attach seq dictionary to them
    gff_handle = open(gff_file)
    annotated_sequence = GFF.parse(gff_handle, base_dict=seq_dict)
    return(annotated_sequence)


def main():
    # connect to the database
    db = 'seqdb'
    dbh = connect(db)

    # parse arguments
    parser = argparse.ArgumentParser(
            description='Script for SNP effect annotation')
    parser.add_argument('-g', action='store',
            dest='genome',
            help='reference genome')
    parser.add_argument('-f', action='store',
            dest='fasta_file',
            help='fasta file with reference sequence')
    parser.add_argument('-a', action='store',
            dest='gff_file',
            help='gff3 formated file with gene annotations')
    arguments = parser.parse_args()
    fasta_file = arguments.fasta_file
    gff_file = arguments.gff_file
    genome = arguments.genome

    # import sequence and annotations
    annotated_sequence = import_annotated_sequence(fasta_file, gff_file)

    # annotate SNPs
    annotSNPeff(annotated_sequence, genome, dbh)


if __name__ == "__main__":
    main()
