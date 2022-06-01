# draw.io-export

Convert [draw.io](https://app.diagrams.net/) xml file (usually `*.drawio`) to `pdf`/`png` within command line.

Works nicely with `make` and/or `latexmk`. Useful if you are writing a paper or thesis with many figures.

## Usage with `npm`

```bash
npm install --global draw.io-export
drawio <source.drawio> -o <dest.pdf>
drawio <source.drawio> -o <dest.png>
```

## Supported formats `-F|--fmt`

- If not specified, automatically detect `png` or `pdf`
- `png` Only the first page is used
- `pdf` Only the first page is used
- `cat-pdf` All pages used, concatenated
- `split-png` All pages used, separate files with name `<dest><#>.png`
- `split-pdf` All pages used, separate files with name `<dest><#>.pdf`
- `split-index-png` Alias for `split-png`
- `split-index-pdf` Alias for `split-pdf`
- `split-id-png` All pages used, separate files with name `<dest><diagram-id>.png`
- `split-id-pdf` All pages used, separate files with name `<dest><diagram-id>.pdf`
- `split-name-png` All pages used, separate files with name `<dest><page-name>.png`
- `split-name-pdf` All pages used, separate files with name `<dest><page-name>.pdf`

## Usage with Docker

```bash
docker run --rm \
         -v <your folder with .drawio files>:/files \
         b1f6c1c4/draw.io-export
```

