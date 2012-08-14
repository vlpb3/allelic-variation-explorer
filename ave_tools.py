import argparse


def import_annotations(gff_files):
    """Read in annotation files and import into db.
    """
    chunkSize = 128


def import_data(args):
    """Import data into a database.
    """
    import_annotations(args.annot)


def main():
    # parse script arguments
    general_description = 'Usefull tools for Allelic Variation Explorer'
    parser = argparse.ArgumentParser(description=general_description)
    subparsers = parser.add_subparsers(title='tools',
            description='available ave tools')
    import_parser = subparsers.add_parser('import',
            help='importing data to ave db')
    import_parser.add_argument('-genome', type=str,
            help='name of the genome')
    import_parser.add_argument('-ref', nargs='*', type=argparse.FileType('r'),
            help='reference sequnce in fasta format')
    import_parser.add_argument('-annot', nargs='*',
            type=argparse.FileType('r'),
            help='annatations in gff3 format')
    import_parser.set_defaults(func=import_data)
    args = parser.parse_args()
    args.func(args)

if __name__ == '__main__':
    main()
