docker build $docker_build_directory -t $docker_repo:${PREFIX}${name} -f dockerfiles/${name}.Dockerfile

tags="${PREFIX}${name}-build-${TRAVIS_BUILD_NUMBER},${PREFIX}${name}-commit-${TRAVIS_COMMIT::8},${PREFIX}${name}"
for tag in ${tags//,/ }
do
  echo "Pushing $docker_repo:${PREFIX}${name} as $docker_repo:$tag"
  docker tag $docker_repo:${PREFIX}${name} $docker_repo:$tag
  docker push $docker_repo:$tag
done
