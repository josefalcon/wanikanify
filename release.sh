version=$1
echo $1
zip -r wanikanify-$1.zip . -x "*.git*" -x README.md -x release.sh

