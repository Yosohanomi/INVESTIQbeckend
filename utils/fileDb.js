import { readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'

// Завжди резолвимо шляхи відносно кореня проєкту,
// а не робочої директорії процесу
function absPath(filePath) {
  return resolve(process.cwd(), filePath)
}

export async function readJSON(filePath) {
  try {
    const data = await readFile(absPath(filePath), 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

export async function writeJSON(filePath, data) {
  await writeFile(absPath(filePath), JSON.stringify(data, null, 2), 'utf-8')
}
