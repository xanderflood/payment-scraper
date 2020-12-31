set -x

tags="${PREFIX}${name}-build-${TRAVIS_BUILD_NUMBER},${PREFIX}${name}-commit-${TRAVIS_COMMIT::8},${PREFIX}${name}"
for tag in ${tags//,/ }
do
  echo "Pushing local:${name} as $docker_repo:$tag"
  docker tag local:${name} $docker_repo:$tag
  docker push $docker_repo:$tag
done
