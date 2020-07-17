# draw.io-export

Convert [draw.io](https://app.diagrams.net/) xml file (usually `*.drawio`) to `pdf`/`png` within command line.

Works nicely with `make` and/or `latexmk`. Useful if you are writing a paper or thesis with many figures.

## Usage with `npm`

```bash
npm install --global draw.io-export
drawio <source.drawio> -o <dest.pdf>
drawio <source.drawio> -o <dest.png>
```

## Usage with Docker

```bash
docker run --rm \
         -v <your folder with .drawio files>:/files \
         b1f6c1c4/draw.io-export
```

