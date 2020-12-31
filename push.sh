set -xe

tags="${PREFIX}${name}-build-${TRAVIS_BUILD_NUMBER},${PREFIX}${name}-commit-${TRAVIS_COMMIT::8},${PREFIX}${name}"
for tag in ${tags//,/ }
do
  echo "Pushing local:${name} as xanderflood/payment:$tag"
  docker tag local:${name} xanderflood/payment:$tag
  docker push xanderflood/payment:$tag
done
