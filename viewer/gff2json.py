#!/usr/bin/python

import sys


fin = open(sys.argv[1])
features = {}
seq = []
linecount = 0
for line in fin:
  linecount+=1
  if ((line[0]==r"#") or line == "\n"):
    continue

  featlist = line.strip().split("\t")
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

