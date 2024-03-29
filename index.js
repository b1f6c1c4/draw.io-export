/* eslint-disable no-console */

const yargs = require('yargs');
const path = require('path');
const run = require('./export');

process.on('unhandledRejection', (e) => {
  console.error(e);
  throw e;
});

process.on('uncaughtException', (e) => {
  console.error(e);
});

const { argv } = yargs
  .usage('$0 <source.drawio> -o [target]')
  .option('F', {
    alias: 'fmt',
    describe: 'output format',
    type: 'string',
  })
  .option('o', {
    alias: 'output',
    demandOption: true,
    default: 'a.png',
    describe: 'output file',
    type: 'string',
  });

if (argv._.length !== 1) {
  throw new Error('Exactly one file at a time');
}

module.exports = () => run({
  file: argv._[0],
  format: argv.fmt || path.extname(argv.output).replace(/^\./, ''),
  path: argv.output,
});
