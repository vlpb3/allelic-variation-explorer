#!/usr/bin/python

import sys
import json

"""
# this script lads data from gff to json
# loads data from file specified via commandline
# writes data in separate json objects:

## position to ID mapping
loc2ID = {'pos': 'ID'}

## ID to position mapping (used in got to feature)
ID2loc = {'ID': 'f'}

structure storing loci data (gene, mRNA, protein, UTR, exon, cds)
genes = {'gene-ID': {
            'transcript-ID': {
                'mRNA' : {f},
                'protein': {f} 
                'five_prime_UTR' : {f},
                'CDSs': [{f}, {f}, {f}],
                'exons': [{f}, {f}, {f}],
                'introns': [{'start': 1, 'end': 10}, {'start': 40, 'end': 70}],
                'three_prime_UTR': [{f}]
            },
            'transcipt-ID': {},
        
    }
}

feature structure, uses columns from gff3 file
f = {
    'seqid': 
    'source':
    'type':
    'start':
    'end':
    'score':
    'strand':
    'phase':
    'attributes': {
        '':
        '':
    }
}
"""

# initialize variables
data = {}
data['loc2ID'] = []
data['ID2f'] = {}
data['genes'] = {}
data['SNPs'] = {}
   
# iterate over provided files and get data:
for fname in sys.argv[1:]:

    fin = open(fname, 'r')
    for line in fin:
        if ((line[0]==r"#") or line == "\n"):
            continue

        featlist = line.strip().split("\t")
        f = {}

        f['seqid'] = featlist[0]
        f['source'] = featlist[1]
        f['type'] = featlist[2]
        f['start'] = featlist[3]
        f['end'] = featlist[4]
        f['score'] = featlist[5]
        f['strand'] = featlist[6]
        f['phase'] = featlist[7]
        attrs = featlist[8].split(";")
        attributes = {}
        for entry in attrs:
            if len(entry):
                key, val = entry.split("=")
                attributes[key] = val
        f['attributes'] = attributes

        ftype = f['type']
        # construct gene structure
        if ftype in  ['gene', 'transposable_element_gene']:
            gene = f['attributes']['ID']
            data['genes'][gene] = {}
    
        # unfortunately features vary a lot, so each must be parsed separatelly
        if ftype == 'mRNA':
            transcript = f['attributes']['ID']
            gene = f['attributes']['Parent']
            try: data['genes'][gene][transcript]['mRNA'] = f
            except: data['genes'][gene][transcript] = {'mRNA': f}

        elif ftype == 'protein':
            transcript = f['attributes']['Derives_from']
            gene = transcript.split('.')[0]
            try: data['genes'][gene][transcript]['protein'] = f
            except: data['genes'][gene][transcript] = {'protein': f}

        elif ftype ==  'CDS':
            transcript = f['attributes']['Parent'].split(',')[0]
            gene = transcript.split('.')[0]
            try: data['genes'][gene][transcript]['CDS'].append(f)
            except:
                try: data['genes'][gene][transcript]['CDS'] = [f]
                except: data['genes'][gene][transcript] = {'CDS': [f]}

        elif ftype in ['five_prime_UTR', 'three_prime_UTR']:
            transcript = f['attributes']['Parent']
            gene = transcript.split('.')[0]
            try: data['genes'][gene][transcript][ftype] = [f]
            except:  data['genes'][gene][transcript] = {ftype: [f]}

        elif ftype == 'exon':
            transcript = f['attributes']['Parent']
            gene = transcript.split('.')[0]
            try: data['genes'][gene][transcript]['exon'].append(f)
            except:
                try: data['genes'][gene][transcript]['exon'] = [f]
                except: data['genes'][gene][transcript] = {'exon': [f]}

    fin.close() 


# Calculate intron positions (not originally in gff,
# but usefull for rendering introns joining exons).

for gene in data['genes']:
    for transcript in gene:
        transcript['intron'] = []
        exon = transcript['exon']
        for idx in range(len(exon) - 1):
            intron = {}
            intron['start'] = exon[idx][end]
            intron['end'] = exon[idx + 1][start]
            transcript['intron'].append(intron)
            
jsonstring = json.dumps(data, sort_keys=True, indent=4)
fout = open('annot.json', 'w')
fout.write(jsonstring)
fout.close()

