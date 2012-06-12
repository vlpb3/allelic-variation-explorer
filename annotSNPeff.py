import sys
from pymongo import Connection
from pymongo.errors import ConnectionFailure


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


def annotSNPeff(dbh):
    """ Annotate all SNPs in the db with their effect.

    Use gene models annotations to determine sffect of iintroduced SNP.
    """
    # fetch list of genomes in the db
    genomes = dbh.features.distinct('attributes.genome')
    # for each genome fetch list of chromosomes
    for genome in genomes:
        chromosomes = dbh.features.find(
                {'attributes.genome': genome, 'type': 'gene'},
                timeout=False).distinct('seqid')
        # for each chromosome fetch genes
        for chrom in chromosomes:
            genes = dbh.features.find(
                    {'attributes.genome': genome,
                        'type': 'gene',
                        'seqid': chrom},
                    timeout=False)
            # for each gene fetch all annotations
            for gene in genes:
                featurelist = ['five_prime_UTR', 'three_prime_UTR', 'CDS']
                features = dbh.features.find(
                        {'attributes.genome': genome,
                            'type': {'$in': featurelist},
                            'seqid': chrom,
                            'start': {'$gte': gene['start']},
                            'end': {'$lte': gene['end']}},
                        timeout=False)

                # fetch all SNPs in the gene
                SNPs = dbh.features.find(
                        {'attiributes.genome': genome,
                            'type': {'$regex': '^SNP'},
                            'seqid': chrom,
                            'start': {'$gte': gene['start']},
                            'end': {'$lte': gene['end']}})

                print gene
                print features
                print SNPs

def main():
    # connect to the database
    db = 'seqdb'
    dbh = connect(db)
    annotSNPeff(dbh)


if __name__ == "__main__":
    main()
