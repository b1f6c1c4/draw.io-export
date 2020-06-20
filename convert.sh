echo "DRAW.IO-EXPORT Started."
dirs=$(find /files -name '*.drawio')

for dir in $dirs
do
    echo "Converting ${dir} to ${dir}.pdf"
    if test -f "${dir}.pdf"; then
        rm $dir.pdf
    fi
    node /home/node/draw.io-export/bin/drawio.js $dir -o $dir.pdf
    echo "Converting ${dir} to ${dir}.png" 
    if test -f "${dir}.png"; then
        rm $dir.png
    fi
    node /home/node/draw.io-export/bin/drawio.js $dir -o $dir.png
done
echo "DRAW.IO-EXPORT Finished."
