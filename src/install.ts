import { mkdirp } from 'fs-extra';
import { extract } from 'tar';
import { request } from 'undici'
import { tickInstalling } from './log';

export default async function(name: string, url: string, location = '') {
  const path = `${process.cwd()}${location}/node_modules/${name}`
  await mkdirp(path)

  const res = await request(url)
  res.body.pipe(extract({ cwd: path, strip: 1 })).on('close', tickInstalling);
}
