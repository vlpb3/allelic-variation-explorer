#!/usr/bin/perl
use strict;
use warnings;
use 5.010; # to use say 

use JSON;

my $line;
my @featurelist;
while (defined($line = <>)) {
  chomp($line);
  if ($line =~ /^##/) {
    # skip commented lines (gff header) 
    next;
  }
  else {
    my @splitted = split(/\t/, $line) or next;
    my %feature = (
        'seqid', $splitted[0],
        'source', $splitted[1],
        'type', $splitted[2],
        'start', $splitted[3],
        'end', $splitted[4],
        'score', $splitted[5],
        'strand', $splitted[6],
        'phase', $splitted[7]);
    # attributes are stored as key vlaue pairs
    my @attr = split(/;/, $splitted[8]);
    my %attributes;
    foreach(@attr) {
      $_=~m/^(.*)=(.*)$/;
      $feature{'attributes'}{$1} = $2;
    }
    push(@featurelist, %feature);
#last;
  }
}

# write to json
my $json->{"sequence"} = \@featurelist;
my $json_text = to_json($json);

# open file for dumping json
open JS, ">sequence.json";
print JS $json_text;
close JS;
