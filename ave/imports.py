import os
from pymongo import Connection
import progressbar as pb
import re
import time

def importGffLines(seqdb, lines):
    features = seqdb.features
    featureList = []
    for line in lines:
        params = line.strip().split('\t')
        if (len(params) != 9) : continue
        feature = {
                'seqid': params[0],
                'source': params[1],
                'type': params[2],
                'start': int(params[3]),
                'end': int(params[4]),
                'score': params[5],
                'strand': params[6],
                'phase': params[7]
                }
        attributes = {}
        attrString = params[8].split(';')
        for attr in attrString:
            attr = attr.split('=')
            if (len(attr) != 2) : continue
            attributes[attr[0]] = attr[1]
        if feature['type'].startswith('SNP'): attributes['coding'] = ''
        feature['attributes'] = attributes
        featureList.append(feature) 
    if len(featureList) <= 0 : print(lines)
    if len(featureList) > 0 : features.insert(featureList, safe=True)

def profileImport(seqdb, gffFiles):
    """Profiles importing features in defferent chunk sizes."""
    chunkSizes = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048]
    times = {}
    for chunkSize in chunkSizes:
        print('tesitng chun size %d' % chunkSize)
        times[chunkSize] = []
        iFile = 0
        for fname in gffFiles:
            t0 = time.time()
            fin = open(fname, 'r')
            print('processing file: %s' % fname)
            lines = fin.readlines()
            iLine = 0
            nLines = len(lines)
            pbar = pb.ProgressBar(widgets=[pb.Percentage(), pb.Bar()], maxval=nLines).start()
            chunk = []
            for line in lines:
                chunk.append(line)  
                if len(chunk) >= chunkSize:
                    importGffLines(seqdb, chunk)
                    chunk = []
                    iLine += chunkSize
                    pbar.update(iLine)
            if len(chunk): importGffLines(seqdb, chunk)
            t = time.time() - t0
            times[chunkSize].append(t)
            pbar.finish()
            iFile += 1
            print('Finished %d of %d' % (iFile, len(gffFiles)))
            print("Import time: %d" % t)
        seqdb.drop_collection(seqdb.features)
    print(times)

    fileSizes = []
    speeds = []
    for iFile in gffFiles:
        fileSizes.append(os.path.getsize(iFile))
    for chunkSize in chunkSizes:
        tList = times[chunkSize]
        speedList = []
        for (t, s) in zip (tList, fileSizes):
            speedList.append(s/t)
        speeds.append(speedList)
    
    import matplotlib.pyplot as plt

    fig = plt.figure()
    ax = fig.add_subplot(111)
    plt.xticks(range(len(chunkSizes)), chunkSizes)
    ax.boxplot(speeds)
    plt.savefig('profiles.png')

def importGff(seqdb, gffFiles):
    """Imports to provided db connection all annotations from gff
    files provided in a list."""

    iFile = 0
    for fname in gffFiles:
        fin = open(fname, 'r')
        print('processing file: %s' % fname)
        lines = fin.readlines()
        nLines = len(lines)
        iLine= 0
        pbar = pb.ProgressBar(widgets=[pb.Percentage(), pb.Bar()], maxval=nLines).start()
        for line in lines:
            importGffLines(seqdb, [line])
            iLine += 1
            pbar.update(iLine)
        pbar.finish()
        iFile += 1

        print('Finished %d of %d' % (iFile, len(gffFiles)))

    print('finished importng gff files')
    print('Indexing features.')
    features.create_index('start')
    features.create_index('end')
    features.create_index('type')
    features.create_index('seqid')
    print('Fiinished indexing features.')
		
def importFasta(seqdb, fastaFiles):
    chunkSize = 1000000
    iFile = 0
    refseqdb = seqdb.refseqs
    # importing refseq from fasta
    for fname in fastaFiles:
        lines = open(fname, 'r').readlines()
        print('processing file: %s' % fname)
        iLine = 0
        nLines = len(lines)
        pbar = pb.ProgressBar(widgets=[pb.Percentage(), pb.Bar()], maxval=nLines).start()
        fullChromMatch = '^>(Chr\w+)'
        posInChromMatch = '^>(Chr\w+):(\d+)\.\.(\d+)'
        chunk = ''
        for line in lines:
            match = re.search(fullChromMatch, line)
            if match:
                # its header line create new refseq document
                refseq = {}
                refseq['chrom'] = match.groups()[0]
                lastEnd = 0
                chrom = refseq['chrom'] 
                # check if it's whole chromosome
                match = re.search(posInChromMatch, line)
                if match:
                    refseq['starts'] = match.groups()[1]
            else:
                refseq['starts'] = lastEnd + 1
                chunk += line.strip()
                if len(chunk) >= chunkSize :
                    refseq['chrom'] = chrom
                    refseq['sequence'] = chunk[:chunkSize]
                    chunk = chunk[chunkSize:]
                    refseq['ends'] = refseq['starts'] + chunkSize -1
                    lastEnd = refseq['ends']
                    refseqdb.insert(refseq, safe=True)         
                    refseq = {}
            iLine += 1
            pbar.update(iLine)
        if len(chunk):
            refseq['chrom'] = chrom
            refseq['starts'] = lastEnd + 1
            refseq['sequence'] = chunk
            refseq['ends'] = lastEnd + len(chunk)
            refseqdb.insert(refseq) 

        pbar.finish()
        iFile += 1
        print('Finished %d of %d' % (iFile, len(fastaFiles)))
    print('Finished impoting fasta files.')
    print('Indexing reference seq.')
    refseqdb.create_index('starts')
    refseqdb.create_index('ends')
    refseqdb.create_index('chrom')
    print('Finished indexing ref seq.')

def main():
    importsDir = './data/imports'
    # get list of all gff files in directory
    dirList = os.listdir(importsDir)
    
    # construct proper paths
    dirList = map(lambda fname: os.path.join(importsDir, fname), dirList)
    # extract gff files
    gffFiles = filter(lambda fname: fname.endswith('.gff'), dirList)
    # extract fasta files
    fastaFiles = filter(lambda fname: fname.endswith('.fas'), dirList)

    # connect to mongodb
    con = Connection()
    seqdb = con.seqdb

    # importFasta(seqdb, fastaFiles)
    # importGff(seqdb, gffFiles)
    profileImport(seqdb, gffFiles)
    print('Finished whole import')

if __name__ == '__main__':
    main()
