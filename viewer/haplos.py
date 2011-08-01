import random

features = []
for i in range(10):
  p1 = random.randint(0,50)
  p2 = random.randint(0,50)
  if p1<p2 :
    features.append((p1, p2))
  else :
    features.append((p2,p1))


def overlaps(a,b):
  if a[0] < b[1] and a[1] > b[0]:
    return True
  else:
    return False

tracks = []
for i in range(len(features)):
  tracks.append([])

for f in (features):
  for tr in tracks:
    if (len(tr) == 0):
      tr.append(f)
      break
    else :
      over = False
      for trel in tr:
        if overlaps(f, trel):
          over = True
          break
      if over :
        continue
      else :
        tr.append(f)
        break

function overlaping(feat1, feat2) {return (feat1.start < feat2.end) && (feat1.end > feat2.start) ? true : false;}

featList = [{start: 4, end: 10},{start: 5, end: 20},{start: 15, end: 30},{start: 23, end: 25}]
