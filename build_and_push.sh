export PREFIX=`if [ "$TRAVIS_BRANCH" == "master" ]; then echo ""; else echo "staging-" ; fi`

docker login -u $DOCKER_USER -p $DOCKER_PASS
docker build . -t local:main -f dockerfiles/main.Dockerfile
docker build . -t local:web -f dockerfiles/web.Dockerfile
docker build . -t local:dbmgr -f dockerfiles/dbmgr.Dockerfile

name=main ./push.sh
name=web ./push.sh
name=dbmgr ./push.sh
