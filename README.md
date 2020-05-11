# draw.io-export

Convert [draw.io](https://app.diagrams.net/) xml file (usually `*.drawio`) to `pdf`/`png` within command line.

Works nicely with `make` and/or `latexmk`. Useful if you are writing a paper or thesis with many figures.

## Usage

```bash
npm install --global draw.io-export
drawio <source.drawio> -o <dest.pdf>
drawio <source.drawio> -o <dest.png>
```
