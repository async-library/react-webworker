import "jest-dom/extend-expect"
import React from "react"
import { render, fireEvent, cleanup, waitForElement } from "react-testing-library"
import WebWorker from "./"

afterEach(cleanup)

const worker = { postMessage: jest.fn(), terminate: jest.fn() }
window.Worker = jest.fn().mockImplementation(() => worker)

test("initializes a Worker on mount", () => {
  const options = {}
  render(<WebWorker url="/worker.js" options={options} />)
  expect(window.Worker).toHaveBeenCalledWith("/worker.js", options)
})

test("passes received messages to children as render prop", async () => {
  const { getByText } = render(<WebWorker>{({ messages }) => messages.map(m => m.data).join()}</WebWorker>)
  worker.onmessage({ data: "foo" })
  worker.onmessage({ data: "bar" })
  worker.onmessage({ data: "baz" })
  await waitForElement(() => getByText("foo,bar,baz"))
})

test("passes data of last received message to children as render prop", async () => {
  const { getByText } = render(<WebWorker>{({ data }) => data}</WebWorker>)
  worker.onmessage({ data: "foo" })
  worker.onmessage({ data: "bar" })
  worker.onmessage({ data: "baz" })
  await waitForElement(() => getByText("baz"))
})

test("passes received errors to children as render prop", async () => {
  const { getByText } = render(<WebWorker>{({ errors }) => errors.map(e => e.error).join()}</WebWorker>)
  worker.onerror({ error: "foo" })
  worker.onerror({ error: "bar" })
  worker.onerror({ error: "baz" })
  await waitForElement(() => getByText("foo,bar,baz"))
})

test("passes last received error to children as render prop", async () => {
  const { getByText } = render(<WebWorker>{({ error }) => error}</WebWorker>)
  worker.onerror({ error: "foo" })
  worker.onerror({ error: "bar" })
  worker.onerror({ error: "baz" })
  await waitForElement(() => getByText("baz"))
})

test("passes updatedAt date when a message is received", async () => {
  const date = new Date().toISOString().substr(0, 10)
  const { getByText, queryByText } = render(
    <WebWorker>{({ updatedAt }) => (updatedAt ? updatedAt.toISOString().substr(0, 10) : null)}</WebWorker>
  )
  expect(queryByText(date)).toBeNull()
  worker.onmessage({ data: "foo" })
  await waitForElement(() => getByText(date))
})

test("passes updatedAt date when an error is received", async () => {
  const date = new Date().toISOString().substr(0, 10)
  const { getByText, queryByText } = render(
    <WebWorker>{({ updatedAt }) => (updatedAt ? updatedAt.toISOString().substr(0, 10) : null)}</WebWorker>
  )
  expect(queryByText(date)).toBeNull()
  worker.onerror({ error: "foo" })
  await waitForElement(() => getByText(date))
})

test("invokes onMessage callback with message data when a message is received", async () => {
  const onMessage = jest.fn()
  render(<WebWorker onMessage={onMessage} />)
  worker.onmessage({ data: "foo" })
  expect(onMessage).toHaveBeenCalledWith("foo")
})

test("invokes onError callback with error when a error is received", async () => {
  const onError = jest.fn()
  render(<WebWorker onError={onError} />)
  worker.onerror({ error: "foo" })
  expect(onError).toHaveBeenCalledWith("foo")
})

test("terminates the worker when unmounted", async () => {
  worker.terminate.mockClear()
  const { unmount } = render(<WebWorker />)
  unmount()
  expect(worker.terminate).toHaveBeenCalled()
})

test("postMessage sends messages to the worker", async () => {
  worker.postMessage.mockClear()
  const { getByText } = render(
    <WebWorker>{({ postMessage }) => <button onClick={() => postMessage("hello")}>go</button>}</WebWorker>
  )
  expect(worker.postMessage).not.toHaveBeenCalled()
  fireEvent.click(getByText("go"))
  expect(worker.postMessage).toHaveBeenCalledWith("hello")
})

test("serializer will prepare messages before sending them to the worker", async () => {
  worker.postMessage.mockClear()
  const { getByText } = render(
    <WebWorker serializer={JSON.stringify}>
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
    <WebWorker parser={JSON.parse} onMessage={onMessage}>
      {({ data }) => data && data.foo}
    </WebWorker>
  )
  worker.onmessage({ data: JSON.stringify({ foo: "bar" }) })
  expect(onMessage).toHaveBeenCalledWith({ foo: "bar" })
  await waitForElement(() => getByText("bar"))
})

test("WebWorker.Data renders with last message data only when a message has been received", async () => {
  const { getByText, queryByText } = render(
    <WebWorker>
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
    <WebWorker>
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
    <WebWorker>
      <WebWorker.Pending>pending</WebWorker.Pending>
    </WebWorker>
  )
  await waitForElement(() => getByText("pending"))
  worker.onmessage({ data: "foo" })
  expect(queryByText("pending")).toBeNull()
})

test("WebWorker.Pending renders only when no error has been received yet", async () => {
  const { getByText, queryByText } = render(
    <WebWorker>
      <WebWorker.Pending>pending</WebWorker.Pending>
    </WebWorker>
  )
  await waitForElement(() => getByText("pending"))
  worker.onerror({ error: "foo" })
  expect(queryByText("pending")).toBeNull()
})
