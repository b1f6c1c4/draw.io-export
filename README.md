# draw.io-export

Convert [draw.io](https://app.diagrams.net/) xml file (usually `*.drawio`) to `pdf`/`png` within command line.

Works nicely with `make` and/or `latexmk`. Useful if you are writing a paper or thesis with many figures.

## Usage with NPM

```bash
npm install --global draw.io-export
drawio <source.drawio> -o <dest.pdf>
drawio <source.drawio> -o <dest.png>
```

## Usage with Docker

```
docker run --name drawioexport \
-v [Your folder with draw.io files]:/files \
davidbonnici1984/draw.io-export:0.1.0
```
