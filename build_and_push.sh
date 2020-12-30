export PREFIX=`if [ "$TRAVIS_BRANCH" == "master" ]; then echo ""; else echo "staging-" ; fi`
export docker_repo=xanderflood/payment
export docker_build_directory=.

docker login -u $DOCKER_USER -p $DOCKER_PASS
name=main ./build_and_push_image.sh
name=web ./build_and_push_image.sh
name=dbmgr ./build_and_push_image.sh
