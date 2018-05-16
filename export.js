const puppeteer = require('puppeteer');
const zlib = require('zlib');
const fetch = require('node-fetch');
const crc = require('crc');
const { DOMParser } = require('xmldom');

const MAX_AREA = 10000 * 10000;
const PNG_CHUNK_IDAT = 1229209940;

// NOTE: Key length must not be longer than 79 bytes (not checked)
function writePngWithText(origBuff, key, text, compressed, base64encoded) {
  let inOffset = 0;
  let outOffset = 0;
  let data = text;
  let dataLen = key.length + data.length + 1; // we add 1 zeros with non-compressed data

  // prepare compressed data to get its size
  if (compressed) {
    data = zlib.deflateRawSync(encodeURIComponent(text));
    dataLen = key.length + data.length + 2; // we add 2 zeros with compressed data
  }

  const outBuff = Buffer.allocUnsafe(origBuff.length + dataLen + 4); // 4 is the header size "zTXt" or "tEXt"

  try {
    const magic1 = origBuff.readUInt32BE(inOffset);
    inOffset += 4;
    const magic2 = origBuff.readUInt32BE(inOffset);
    inOffset += 4;

    if (magic1 != 0x89504e47 && magic2 != 0x0d0a1a0a) {
      throw new Error('PNGImageDecoder0');
    }

    outBuff.writeUInt32BE(magic1, outOffset);
    outOffset += 4;
    outBuff.writeUInt32BE(magic2, outOffset);
    outOffset += 4;
  } catch (e) {
    logger.error(e.message, { stack: e.stack });
    throw new Error('PNGImageDecoder1');
  }

  while (inOffset < origBuff.length) {
    const length = origBuff.readInt32BE(inOffset);
    inOffset += 4;
    const type = origBuff.readInt32BE(inOffset);
    inOffset += 4;

    if (type == PNG_CHUNK_IDAT) {
      // Insert zTXt chunk before IDAT chunk
      outBuff.writeInt32BE(dataLen, outOffset);
      outOffset += 4;

      const typeSignature = (compressed) ? 'zTXt' : 'tEXt';
      outBuff.write(typeSignature, outOffset);

      outOffset += 4;
      outBuff.write(key, outOffset);
      outOffset += key.length;
      outBuff.writeInt8(0, outOffset);
      outOffset++;

      if (compressed) {
        outBuff.writeInt8(0, outOffset);
        outOffset++;
        data.copy(outBuff, outOffset);
      } else {
        outBuff.write(data, outOffset);
      }

      outOffset += data.length;

      const crcVal = crc.crc32(typeSignature);
      crc.crc32(data, crcVal);

      // CRC
      outBuff.writeInt32BE(crcVal ^ 0xffffffff, outOffset);
      outOffset += 4;

      // Writes the IDAT chunk after the zTXt
      outBuff.writeInt32BE(length, outOffset);
      outOffset += 4;
      outBuff.writeInt32BE(type, outOffset);
      outOffset += 4;

      origBuff.copy(outBuff, outOffset, inOffset);

      // Encodes the buffer using base64 if requested
      return base64encoded ? outBuff.toString('base64') : outBuff;
    }

    outBuff.writeInt32BE(length, outOffset);
    outOffset += 4;
    outBuff.writeInt32BE(type, outOffset);
    outOffset += 4;

    origBuff.copy(outBuff, outOffset, inOffset, inOffset + length + 4);// +4 to move past the crc

    inOffset += length + 4;
    outOffset += length + 4;
  }
}

async function handleRequest(req, res) {
  let xml;
  if (req.body.url) {
    const urlRes = await fetch(req.body.url);
    xml = await urlRes.text();

    if (req.body.format == null) { req.body.format = 'png'; }
  } else if (req.body.xmldata) {
    try {
      xml = zlib.inflateRawSync(
        new Buffer(decodeURIComponent(req.body.xmldata), 'base64'),
      ).toString();
    } catch (e) {
      logger.info(`Inflate failed for XML input: ${req.body.xmldata}`);
      throw e;
    }
  } else {
    xml = req.body.xml;
  }

  if (xml != null && xml.indexOf('%3C') == 0) {
    xml = decodeURIComponent(xml);
  }

  // Extracts the compressed XML from the DIV in a HTML document
  if (xml != null && (xml.indexOf('<!DOCTYPE html>') == 0 || xml.indexOf('<!--[if IE]><meta http-equiv') == 0)) // TODO not tested!
  {
    try {
      var doc = new DOMParser().parseFromString(xml);
      let divs = doc.documentElement.getElementsByTagName('div');

      if (divs != null && divs.length > 0 && (divs.item(0).attributes.getNamedItem('class').nodeValue) == 'mxgraph') {
        if (divs.item(0).nodeType == 1) {
          if (divs.item(0).hasAttribute('data-mxgraph')) {
            const jsonString = divs.item(0).getAttribute('data-mxgraph');

            if (jsonString != null) {
              const obj = JSON.parse(jsonString);
              xml = obj.xml;
            }
          } else {
            divs = divs.item(0).getElementsByTagName('div');

            if (divs != null && divs.length > 0) {
              let tmp = divs.item(0).textContent;

              if (tmp != null) {
                tmp = zlib.inflateRawSync(new Buffer(tmp, 'base64')).toString();

                if (tmp != null && tmp.length > 0) {
                  xml = decodeURIComponent(tmp);
                }
              }
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Extracts the URL encoded XML from the content attribute of an SVG node
  if (xml != null && (xml.indexOf(
    '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">',
  ) == 0)) { // TODO not tested!
    try {
      var doc = new DOMParser().parseFromString(xml);

      if (doc != null && doc.documentElement != null && doc.documentElement.nodeName == 'svg') {
        const content = doc.documentElement.getAttribute('content');

        if (content != null) {
          xml = content;

          if (xml.charAt(0) == '%') {
            xml = decodeURIComponent(xml);
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  req.body.w = req.body.w || 0;
  req.body.h = req.body.h || 0;

  // Checks parameters
  if (req.body.format && xml && req.body.w * req.body.h <= MAX_AREA) {
    var page = null,
      browser = null,
      errorOccurred = false;

    req.body.xml = xml;

    const t0 = Date.now();

    browser = await browsersPool.acquire();

    page = await browser.newPage();

    await page.goto('https://www.draw.io/export3.html', { waitUntil: 'networkidle0' });

    const result = await page.evaluate((body) => render({
      xml: body.xml,
      format: body.format,
      w: body.w,
      h: body.h,
      border: body.border || 0,
      bg: body.bg,
      from: body.from,
      to: body.to,
      scale: body.scale || 1,
    }), req.body);

    // default timeout is 30000 (30 sec)
    await page.waitForSelector('#LoadingComplete');

    let bounds = await page.mainFrame().$eval('#LoadingComplete', (div) => div.getAttribute('bounds'));
    let pdfOptions = { format: 'A4' };

    if (bounds != null) {
      bounds = JSON.parse(bounds);

      // Chrome generates Pdf files larger than requested pixels size and requires scaling
      const fixingScale = 0.959;

      var w = Math.ceil(bounds.width * fixingScale);
      var h = Math.ceil(bounds.height * fixingScale);

      page.setViewport({ width: w, height: h });

      pdfOptions = {
        printBackground: true,
        width: `${w}px`,
        height: `${h + 1}px`, // the extra pixel to prevent adding an extra empty page
        margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' },
      };
    }

    // req.body.filename = req.body.filename || ("export." + req.body.format);
    const base64encoded = req.body.base64 == '1';

    if (req.body.format == 'png' || req.body.format == 'jpg' || req.body.format == 'jpeg') {
      var data = await page.screenshot({
        omitBackground: req.body.format == 'png' && (req.body.bg == null || req.body.bg == 'none'),
        type: req.body.format == 'jpg' ? 'jpeg' : req.body.format,
        fullPage: true,
      });

      if (req.body.embedXml == '1' && req.body.format == 'png') {
        data = writePngWithText(data, 'mxGraphModel', xml, true, base64encoded);
      } else {
        if (base64encoded) {
          data = data.toString('base64');
        }

        if (data.length == 0) {
          throw new Error('Invalid image');
        }
      }

      if (req.body.filename != null) {
        logger.info(`Filename in request ${req.body.filename}`);

        res.header('Content-disposition', `attachment; filename="${req.body.filename}"; filename*=UTF-8''${req.body.filename}`);
      }

      res.header('Content-type', base64encoded ? 'text/plain' : (`image/${req.body.format}`));
      res.header('Content-Length', data.length);

      // These two parameters are for Google Docs or other recipients to transfer the real image width x height information
      // (in case this information is inaccessible or lost)
      res.header('content-ex-width', w);
      res.header('content-ex-height', h);

      res.end(data);

    } else if (req.body.format == 'pdf') {
      var data = await page.pdf(pdfOptions);

      if (req.body.filename != null) {
        res.header('Content-disposition', `attachment; filename="${req.body.filename}"; filename*=UTF-8''${req.body.filename}`);
      }

      if (base64encoded) {
        data = data.toString('base64');
      }

      res.header('Content-type', base64encoded ? 'text/plain' : 'application/pdf');
      res.header('Content-Length', data.length);
      res.end(data);
    }
  }
}
