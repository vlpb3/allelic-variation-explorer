Allelic Variation Explorer
--------------------------

Installation instructions:

install
git, libssl-dev (or openssl-devel), gcc-c++

mongodb
follow instruction here http://www.mongodb.org/downloads
for your platform, best is to install from 10gen repositories instead of
linux distribution repositories (10gen repos are always much more up to date)

node.js
from http://nodejs.org/#

install npm (node package manager)
wget http://npmjs.org/install.sh
./install.sh

download ave app and go into ave directory
to install needed node packages run:
npm install

download data files 

make sure mongodb is running
you can run "mongo",if you get a mongo console, that means db is running

imports are done with python scripts
make sure you have python installed
also install python modules:
pymongo and progressbar

ipmort data:
python imports.py /path/to/data

run application:
node app.js
you can access the app on localhost:3000

if you wont to access the app from outside you need to
provide the adress by setting the variable appAddress in ave/public/javascripts/client.js
