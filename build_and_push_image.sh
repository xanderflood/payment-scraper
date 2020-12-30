#!/bin/sh -xe

docker build $docker_build_directory -t $docker_repo:${PREFIX}${name} -f dockerfiles/${name}.Dockerfile

tags="${PREFIX}${name}-build-${TRAVIS_BUILD_NUMBER},${PREFIX}${name}-commit-${TRAVIS_COMMIT::8},${PREFIX}${name}"
for tag in ${tags//,/ }
do
  docker tag $docker_repo:${PREFIX}${name} $docker_repo:$tag
  docker push $docker_repo:$tag
done
