const NUM_EXISTING = 5000
const NUM_NEW = 5000

// Setup existing devices
const existingHidDevices = Array.from({ length: NUM_EXISTING }, (_, i) => ({
  id: `vendor${i}:product${i}:name${i}`
}))

// Setup new devices
const newDevices = Array.from({ length: NUM_NEW }, (_, i) => ({
  vendorId: `vendor${i + (NUM_EXISTING / 2)}`,
  productId: `product${i + (NUM_EXISTING / 2)}`,
  productName: `name${i + (NUM_EXISTING / 2)}`
}))

function testSome() {
  const result = []
  const start = performance.now()
  for (const device of newDevices) {
    const id = `${device.vendorId}:${device.productId}:${device.productName}`
    if (!existingHidDevices.some(d => d.id === id)) {
      result.push(id)
    }
  }
  const end = performance.now()
  return { time: end - start, result }
}

function testSet() {
  const result = []
  const start = performance.now()
  const existingSet = new Set(existingHidDevices.map(d => d.id))
  for (const device of newDevices) {
    const id = `${device.vendorId}:${device.productId}:${device.productName}`
    if (!existingSet.has(id)) {
      result.push(id)
      existingSet.add(id) // Important if requested array has duplicates
    }
  }
  const end = performance.now()
  return { time: end - start, result }
}

const someResult = testSome()
const setResult = testSet()

console.log(`Original (.some) implementation: ${someResult.time.toFixed(2)}ms`)
console.log(`Optimized (Set) implementation: ${setResult.time.toFixed(2)}ms`)
console.log(`Improvement: ${(someResult.time / setResult.time).toFixed(2)}x`)

if (someResult.result.length !== setResult.result.length) {
  console.error('Mismatched results length!', someResult.result.length, setResult.result.length)
}
