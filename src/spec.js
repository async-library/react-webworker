import "jest-dom/extend-expect"
import React from "react"
import { render, fireEvent, cleanup, waitForElement } from "react-testing-library"
import WebWorker from "./"

afterEach(cleanup)

const worker = { onmessage: null, postMessage: jest.fn(), terminate: jest.fn() }
const serviceWorker = { postMessage: jest.fn() }
const messageChannel = { port1: {}, port2: jest.fn() }
window.Worker = jest.fn().mockImplementation(() => worker)
window.ServiceWorker = jest.fn().mockImplementation(() => serviceWorker)
window.MessageChannel = jest.fn().mockImplementation(() => messageChannel)

test("initializes a Worker on mount", () => {
  const options = {}
  render(<WebWorker url="/worker.js" options={options} />)
  expect(window.Worker).toHaveBeenCalledWith("/worker.js", options)
})

test("passes received messages to children as render prop", async () => {
  const { getByText } = render(
    <WebWorker url="/worker.js">{({ messages }) => messages.map(m => m.data).join()}</WebWorker>
  )
  worker.onmessage({ data: "foo" })
  worker.onmessage({ data: "bar" })
  worker.onmessage({ data: "baz" })
  await waitForElement(() => getByText("foo,bar,baz"))
})

test("passes data of last received message to children as render prop", async () => {
  const { getByText } = render(<WebWorker url="/worker.js">{({ data }) => data}</WebWorker>)
  worker.onmessage({ data: "foo" })
  worker.onmessage({ data: "bar" })
  worker.onmessage({ data: "baz" })
  await waitForElement(() => getByText("baz"))
})

test("passes received errors to children as render prop", async () => {
  const { getByText } = render(
    <WebWorker url="/worker.js">{({ errors }) => errors.map(e => e.error).join()}</WebWorker>
  )
  worker.onerror({ error: "foo" })
  worker.onerror({ error: "bar" })
  worker.onerror({ error: "baz" })
  await waitForElement(() => getByText("foo,bar,baz"))
})

test("passes last received error to children as render prop", async () => {
  const { getByText } = render(<WebWorker url="/worker.js">{({ error }) => error}</WebWorker>)
  worker.onerror({ error: "foo" })
  worker.onerror({ error: "bar" })
  worker.onerror({ error: "baz" })
  await waitForElement(() => getByText("baz"))
})

test("passes updatedAt date when a message is received", async () => {
  const date = new Date().toISOString().substr(0, 10)
  const { getByText, queryByText } = render(
    <WebWorker url="/worker.js">
      {({ updatedAt }) => (updatedAt ? updatedAt.toISOString().substr(0, 10) : null)}
    </WebWorker>
  )
  expect(queryByText(date)).toBeNull()
  worker.onmessage({ data: "foo" })
  await waitForElement(() => getByText(date))
})

test("passes updatedAt date when an error is received", async () => {
  const date = new Date().toISOString().substr(0, 10)
  const { getByText, queryByText } = render(
    <WebWorker url="/worker.js">
      {({ updatedAt }) => (updatedAt ? updatedAt.toISOString().substr(0, 10) : null)}
    </WebWorker>
  )
  expect(queryByText(date)).toBeNull()
  worker.onerror({ error: "foo" })
  await waitForElement(() => getByText(date))
})

test("invokes onMessage callback with message data when a message is received", async () => {
  const onMessage = jest.fn()
  render(<WebWorker url="/worker.js" onMessage={onMessage} />)
  worker.onmessage({ data: "foo" })
  expect(onMessage).toHaveBeenCalledWith("foo")
})

test("invokes onError callback with error when a error is received", async () => {
  const onError = jest.fn()
  render(<WebWorker url="/worker.js" onError={onError} />)
  worker.onerror({ error: "foo" })
  expect(onError).toHaveBeenCalledWith("foo")
})

test("terminates the worker when unmounted", async () => {
  worker.terminate.mockClear()
  const { unmount } = render(<WebWorker url="/worker.js" />)
  unmount()
  expect(worker.terminate).toHaveBeenCalled()
})

test("postMessage sends messages to the worker", async () => {
  worker.postMessage.mockClear()
  const { getByText } = render(
    <WebWorker url="/worker.js">
      {({ postMessage }) => <button onClick={() => postMessage("hello")}>go</button>}
    </WebWorker>
  )
  expect(worker.postMessage).not.toHaveBeenCalled()
  fireEvent.click(getByText("go"))
  expect(worker.postMessage).toHaveBeenCalledWith("hello")
})

test("calling postMessage before having setup a worker will throw", async () => {
  render(
    <WebWorker url="/worker.js">
      {({ postMessage }) => {
        expect(() => postMessage("hello")).toThrow(new Error("Worker not initialized"))
      }}
    </WebWorker>
  )
})

test("serializer will prepare messages before sending them to the worker", async () => {
  worker.postMessage.mockClear()
  const { getByText } = render(
    <WebWorker url="/worker.js" serializer={JSON.stringify}>
      {({ postMessage }) => <button onClick={() => postMessage({ foo: "bar" })}>go</button>}
    </WebWorker>
  )
  expect(worker.postMessage).not.toHaveBeenCalled()
  fireEvent.click(getByText("go"))
  expect(worker.postMessage).toHaveBeenCalledWith(JSON.stringify({ foo: "bar" }))
})

test("parser will deserialize messages received from the worker", async () => {
  const onMessage = jest.fn()
  const { getByText } = render(
    <WebWorker url="/worker.js" parser={JSON.parse} onMessage={onMessage}>
      {({ data }) => data && data.foo}
    </WebWorker>
  )
  worker.onmessage({ data: JSON.stringify({ foo: "bar" }) })
  expect(onMessage).toHaveBeenCalledWith({ foo: "bar" })
  await waitForElement(() => getByText("bar"))
})

test("supports passing a custom Worker instance", () => {
  const onMessage = jest.fn()
  const customWorker = { onmessage: null, postMessage: jest.fn() }
  const { getByText } = render(
    <WebWorker worker={customWorker} onMessage={onMessage}>
      {({ postMessage }) => <button onClick={() => postMessage("hello")}>go</button>}
    </WebWorker>
  )
  customWorker.onmessage({ data: "foo" })
  expect(onMessage).toHaveBeenCalledWith("foo")
  expect(customWorker.postMessage).not.toHaveBeenCalled()
  fireEvent.click(getByText("go"))
  expect(customWorker.postMessage).toHaveBeenCalledWith("hello")
})

test("custom workers don't terminate on unmount", async () => {
  const customWorker = { terminate: jest.fn() }
  const { unmount } = render(<WebWorker worker={customWorker} />)
  unmount()
  expect(customWorker.terminate).not.toHaveBeenCalled()
})

test("supports Service Workers", () => {
  const onMessage = jest.fn()
  const customWorker = window.ServiceWorker()
  const { getByText } = render(
    <WebWorker worker={customWorker} onMessage={onMessage}>
      {({ postMessage }) => <button onClick={() => postMessage("hello")}>go</button>}
    </WebWorker>
  )
  expect(customWorker.postMessage).not.toHaveBeenCalled()
  fireEvent.click(getByText("go"))
  expect(customWorker.postMessage).toHaveBeenCalledWith("hello", [messageChannel.port2])
})

test("WebWorker.Data renders with last message data only when a message has been received", async () => {
  const { getByText, queryByText } = render(
    <WebWorker url="/worker.js">
      <WebWorker.Data>{data => data}</WebWorker.Data>
    </WebWorker>
  )
  expect(queryByText("foo")).toBeNull()
  worker.onmessage({ data: "foo" })
  await waitForElement(() => getByText("foo"))
  worker.onmessage({ data: "bar" })
  await waitForElement(() => getByText("bar"))
  worker.onmessage({ data: "baz" })
  await waitForElement(() => getByText("baz"))
})

test("WebWorker.Error renders with last error only when an error has been received", async () => {
  const { getByText, queryByText } = render(
    <WebWorker url="/worker.js">
      <WebWorker.Error>{error => error}</WebWorker.Error>
    </WebWorker>
  )
  expect(queryByText("foo")).toBeNull()
  worker.onerror({ error: "foo" })
  await waitForElement(() => getByText("foo"))
  worker.onerror({ error: "bar" })
  await waitForElement(() => getByText("bar"))
  worker.onerror({ error: "baz" })
  await waitForElement(() => getByText("baz"))
})

test("WebWorker.Pending renders only when no message has been received yet", async () => {
  const { getByText, queryByText } = render(
    <WebWorker url="/worker.js">
      <WebWorker.Pending>pending</WebWorker.Pending>
    </WebWorker>
  )
  await waitForElement(() => getByText("pending"))
  worker.onmessage({ data: "foo" })
  expect(queryByText("pending")).toBeNull()
})

test("WebWorker.Pending renders only when no error has been received yet", async () => {
  const { getByText, queryByText } = render(
    <WebWorker url="/worker.js">
      <WebWorker.Pending>pending</WebWorker.Pending>
    </WebWorker>
  )
  await waitForElement(() => getByText("pending"))
  worker.onerror({ error: "foo" })
  expect(queryByText("pending")).toBeNull()
})

test("An unrelated change in props does not update the Context", async () => {
  let one
  let two
  const { rerender } = render(
    <WebWorker url="/worker.js">
      <WebWorker.Pending>
        {value => {
          one = value
        }}
      </WebWorker.Pending>
    </WebWorker>
  )
  rerender(
    <WebWorker url="/worker.js" someProp>
      <WebWorker.Pending>
        {value => {
          two = value
        }}
      </WebWorker.Pending>
    </WebWorker>
  )
  expect(one).toBe(two)
})
