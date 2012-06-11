import sys
from pymongo import Connection
from pymongo.errors import ConnectionFailure
from Bio.Seq import Seq
from Bio.Alphabet import generic_dna


def connect(db):
    """ Connect to the database.

    Return database handle.

    """
    try:
        con = Connection(host="localhost", port=27017)
    except ConnectionFailure, e:
        sys.stderr.write("Could not connect to the db: %s" % e)
        sys.exit(1)
    dbh = con[db]
    return dbh


def in_splice_site(dbh, feature, gene):
    """ Check if feature is within splice site.

        Within splice site is understood as with 2 nucleotides from any CDS.
    """
    pos = feature['start']
    chrom = feature['seqid']
    genome = feature['attributes']['genome']
    gene_start = gene['start']
    gene_end = gene['end']

    # get all CDSs of this gene
    CDSs = dbh.feature.find(
            {'attributes.genome': genome,
                'type': 'CDS',
                'seqid': chrom,
                'start': {'$gte': gene_start},
                'end': {'$lte': gene_end}})
    in_splice_site = False
    for CDS in CDSs:
        dist_from_start = CDS['start'] - pos
        dist_from_end = pos - CDS['end']
        if ((dist_from_start <= 2 and dist_from_start >= 0)
                or (dist_from_end <= 2 and dist_from_end >= 0)):
            in_splice_site = True
    return(in_splice_site)


def location_within_gene(dbh, feature, gene):
    """ Determine whithin which region of the gene is the feature
    """
    pos = feature['start']
    chrom = feature['seqid']
    genome = feature['attributes']['genome']
    features = ['five_prime_UTR', 'three_prime_UTR', 'CDS']

    gene_feature = dbh.features.find_one(
            {'attributes.genome': genome,
                'type': {'$in': features},
                'seqid': chrom,
                'start': {'$lte': pos},
                'end': {'$gte': pos}
                })
    if gene_feature:
        return gene_feature['type']
    else:
        # its within intron, check if it's splice site
        # (meaning within first or last two nucleotides in intron)
        if(in_splice_site(dbh, feature, gene)):
            return('splice_site')
        else:
            return('intergenic')


def get_feature_refseq(dbh, feature):
    """ Return reference sequence of the annotated fragment.

    """
    print feature
    feature_start = int(feature['start'])
    feature_end = int(feature['end'])
    lq = {
            'genome': feature['attributes']['genome'],
            'chrom': feature['seqid'],
            'starts': {'$lte': feature_start},
            'ends': {'$gte': feature_start}}
    rq = {
            'genome': feature['attributes']['genome'],
            'chrom': feature['seqid'],
            'starts': {'$lte': feature_end},
            'ends': {'$gte': feature_end}}
    print "left: "
    print lq
    print "right: "
    print rq
    left_query = dbh.refseqs.find(lq)
    right_query = dbh.refseqs.find(rq)
    refseqs = []
    for chunk in left_query:
        print "left chunks: "
        print chunk['starts']
        print chunk['ends']
        refseqs.append(chunk)
    for chunk in right_query:
        print "right chunks: "
        print chunk['starts']
        print chunk['ends']
        refseqs.append(chunk)

    # if feature spans two or more refseq fragments,
    # concatenate them in proper order
    # sort by start
    refseqs = sorted(refseqs, key=lambda rs: rs['starts'])
    # concatenate sequence strings
    refseq = ""
    for chunk in refseqs:
        refseq += chunk['sequence']
    # get start and end of concatenated chunk
    start = refseqs[0]['starts']
    feature_start_idx = feature['start'] - start
    feature_end_idx = feature['end'] - start + 1
    refseq = refseq[feature_start_idx:feature_end_idx]

    return(refseq)


def determine_coding_effect(dbh, snp, gene):
    """ Determine changes introduced by SNP

    """
    # get CDS(s) in which SNP is located
    genome = str(snp['attributes']['genome'])
    chrom = str(snp['seqid'])
    start = snp['start']
    end = snp['end']
    query = {
        'attributes.genome': genome,
        'seqid': chrom,
        'type': 'CDS',
        'start': {'$lte': start},
        'end': {'$gte': end}}
    print query
    CDSs = dbh.features.find(query)
    # check if there is more than one CDS
    same_phase = True
    if CDSs.count() > 1:
        # check if they have same phase
        phase = -1
        for cds in CDSs:
            if phase >= 0:
                if phase != cds['phase']:
                    same_phase = False
            else:
                phase = cds['phase']
        CDSs.rewind()
    if same_phase:
        # determine aa change
        cds = CDSs.next()
        print cds
        phase = int(cds['phase'])
        strand = cds['strand']
        # fetch reference sequence of the CDS
        refseq = get_feature_refseq(dbh, cds)

        print refseq
        # ommit before phase nucleotides
        if strand == '+':
            refseq = refseq[phase:]
            snp_position = snp['start'] - cds['start'] - phase
        else:
            if phase > 0:
                refseq = refseq[:-phase]
            print refseq
            snp_position = snp['start'] - cds['start']

        # get variant sequence
        variant = snp['attributes']['Change'].split(':')[1]
        varseq = refseq[:snp_position] + variant + refseq[snp_position + 1:]
        # create Bio.Seq.Seq objects for easier manipulation
        refBioSeq = Seq(refseq, generic_dna)
        varBioSeq = Seq(varseq, generic_dna)
        # if CDS is coded on "-" strand get reverse complement
        if strand == '-':
            refBioSeq = refBioSeq.reverse_complement()
            varBioSeq = varBioSeq.reverse_complement()
            print refBioSeq
            snp_position = len(refBioSeq.tostring()) - snp_position - 1

        print snp_position
        changed_aa = snp_position / 3

        # if SNP is in last codon which is not whole in that cds
        # return ambiguous
        if (len(refBioSeq) / 3) * 3 + 3 > snp_position:
            variation = {'consequence': 'ambiguous'}
            return variation
        # if SNP is in the in the range of phase
        # return ambiguous
        if snp_position < phase:
            variation = {'consequence': 'ambiguous'}
            return variation

        # translate to protein
        ref_peptide = refBioSeq.translate()
        var_peptide = varBioSeq.translate()
        print changed_aa
        print len(ref_peptide.tostring())
        refAA = ref_peptide.tostring()[changed_aa]
        varAA = var_peptide.tostring()[changed_aa]
        codon_start = (snp_position / 3) * 3
        codon_end = codon_start + 3
        refCodon = refBioSeq.tostring()[codon_start:codon_end]
        varCodon = varBioSeq.tostring()[codon_start:codon_end]

        if refAA == varAA:
            consequence = 'synonymous'
        else:
            consequence = 'nonsynonymous'

        # store results in variation dictionary
        variation = {
                'refAA': refAA,
                'varAA': varAA,
                'refCodon': refCodon,
                'varCodon': varCodon,
                'consequence': consequence
                }
    else:
        # change is not detrmined
        variation = {
                'consequence':  'ambiguous'
                }
    return(variation)


def annotate_SNPs(dbh):
    """ Annotate SNPs according to their location.

    """
    genomes = ['TAIR9', 'TAIR10']
    # fetch all SNPs
    snps = dbh.features.find(
            {'attributes.genome': {'$in': genomes},
                'type': {'$regex': '^SNP'}}, timeout=False)

    # iterate over SNPs
    for snp in snps:
        pos = snp['start']
        chrom = snp['seqid']
        genome = snp['attributes']['genome']
        # find out if it falls into any gene annotation range
        genes = dbh.features.find(
                {'attributes.genome': genome,
                    'seqid': chrom,
                    'type': 'gene',
                    'end': {'$gte': pos}, 'start': {'$lte': pos}}
                )
        # if snp in a gene
        if genes.count():
            # determine its location within gene (5'utr, 3'utr, intron, CDS)
            gene = genes.next()
            location = location_within_gene(dbh, snp, gene)
            if (location == 'CDS'):
                location = 'coding'
                variation = determine_coding_effect(dbh, snp, gene)
        else:
            # otherwise it's intergenic
            location = 'intergenic'
            variation = {}
        variation['location'] = location
        dbh.features.update(
                snp,
                {'$set':
                    {'attributes.variation': variation}},
                safe=True)
        print(location)


def main():

    # get handle to a sequence db
    dbh = connect('seqdb')
    annotate_SNPs(dbh)

    # cdsPos = dbh.features.find(
    #         {'attributes.genome': {'$in': ['TAIR10', 'TAIR9']},
    #         'type': 'CDS'}, {'seqid': 1, 'start': 1, 'end': 1},
    #         timeout=False)

    # for pos in cdsPos:
    #     seqid = pos['seqid']
    #     start = pos['start']
    #     end = pos['end']

    #     print("Annotating SNPs at: %s from: %d to %d" % (seqid, start, end))
    #     snpQuery = {
    #             'attributes.genome': {'$in': ["TAIR9", "TAIR10"]},
    #             'type': {'$regex': '^SNP'},
    #             'seqid': seqid,
    #             'start': {'$gte': start, '$lte': end},
    #             }
    #     dbh.features.update(snpQuery,
    #     {'$set': {'attributes.coding': 'true'}},
    #        multi=True, safe=True)

    # cdsPos.close()

if __name__ == "__main__":
    main()
