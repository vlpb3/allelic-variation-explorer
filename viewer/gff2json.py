#!/usr/bin/python

import sys

# this script lads data from gff to json
# loads data from file specified via commandline
# writes data in separate json objects:

# position to ID mapping
loc2ID = {'pos': 'ID'}

# ID to position mapping (used in got to feature)
ID2loc = {'ID': 'pos'}

# structure storing loci data (gene, mRNA, protein, UTR, exon, cds)
loci = {'loci-ID': 
        'five_prime_UTR': {f},
        'mRNA':{ 
            'mRNA-ID': {
                'five_prime_UTR' : {f},
                'CDS': [{f}, {f}, {f}, {f}],
                'exon': [{f}, {f}, {f}, {f}],
                'intron': [{'start': 1, 'end': 10}],
                'three_prime_UTR': [{f}, {f}]
            } 
        }
        
       }

# SNP data
SNPs = {}



fin = open(sys.argv[1])
#features = {}
seq = []
linecount = 0
for line in fin:
  linecount+=1
  if ((line[0]==r"#") or line == "\n"):
    continue

  featlist = line.strip().split("\t")
  features = {}
  features['seqid'] = featlist[0]
  features['source'] = featlist[1]
  features['type'] = featlist[2]
  features['start'] = featlist[3]
  features['end'] = featlist[4]
  features['score'] = featlist[5]
  features['strand'] = featlist[6]
  features['phase'] = featlist[7]
  attrs = featlist[8].split(";")
  attributes = {}
  for entry in attrs:
    key, val = entry.split("=")
    attributes[key] = entry
  features['attributes'] = attributes
  seq.append(features)

fout = open('seq.json', 'w')
fout.write("seq = %s" % seq)
fout.close()

