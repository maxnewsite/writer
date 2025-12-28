import { ipcMain } from 'electron'
import { BookRepository, CreateBookData } from '../database/repositories/bookRepository'

export function registerBookHandlers(bookRepo: BookRepository): void {
  ipcMain.handle('books:create', async (_, data: CreateBookData) => {
    return bookRepo.create(data)
  })

  ipcMain.handle('books:getAll', async () => {
    return bookRepo.getAll()
  })

  ipcMain.handle('books:getById', async (_, id: number) => {
    return bookRepo.getById(id)
  })

  ipcMain.handle('books:update', async (_, id: number, data: any) => {
    bookRepo.update(id, data)
    return bookRepo.getById(id)
  })

  ipcMain.handle('books:delete', async (_, id: number) => {
    bookRepo.delete(id)
  })
}
