import '@testing-library/jest-dom'

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock HTML5 drag and drop API
Object.defineProperty(window, 'DragEvent', {
  value: class DragEvent extends Event {
    dataTransfer: DataTransfer
    constructor(type: string, eventInitDict?: DragEventInit) {
      super(type, eventInitDict)
      this.dataTransfer = {
        dropEffect: 'none',
        effectAllowed: 'all',
        files: [] as any,
        items: [] as any,
        types: [],
        clearData: () => {},
        getData: () => '',
        setData: () => {},
        setDragImage: () => {},
      } as DataTransfer
    }
  }
})

// Mock DataTransfer
global.DataTransfer = class DataTransfer {
  dropEffect = 'none'
  effectAllowed = 'all'
  files = [] as any
  items = [] as any
  types: string[] = []
  clearData() {}
  getData() { return '' }
  setData() {}
  setDragImage() {}
}