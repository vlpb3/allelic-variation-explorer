from pymongo import Connection
from pymongo.errors import ConnectionFailure

def main():
    """Annotate coding SNPs in a db."""
    try:
        c = Connection(host="localhost", port = 27017)
    except ConnectionFailure, e:
        sys.stderr.write("Could not connect to the db: %s" % e)
        sys.exit(1)
    
    # get handle to a sequence db
    dbh = c["seqdb"]
    
    cdsPos = dbh.features.find({'type': 'CDS'}, {'seqid': 1, 'start': 1, 'end': 1},
            timeout=False)

    for pos in cdsPos:
        seqid = pos['seqid']
        start = pos['start']
        end = pos['end']

        print("Annotating SNPs at: %s from: %d to %d" % (seqid, start, end))
        snpQuery = {
                'type': {'$regex': '^SNP'},
                'seqid': seqid,
                'start': {'$gte': start, '$lte': end},
                }
        dbh.features.update(snpQuery, {'$set': {'attributes.coding': 'true'}},
           multi=True, safe=True)

    cdsPos.close()

if __name__ == "__main__":
    main()
