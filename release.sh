version=$1
dir=`pwd`
echo $1
zip -r wanikanify-$1.zip $dir -x "*.git*"

