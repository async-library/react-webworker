import React from "react"

const { Consumer, Provider } = React.createContext()

class WebWorker extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      messages: [],
      errors: [],
      data: undefined,
      error: undefined,
      updatedAt: undefined,
      lastPostAt: undefined,
      postMessage: this.postMessage
    }
  }

  onMessage = message => {
    if (!this.mounted) return
    const data = this.props.parser ? this.props.parser(message.data) : message.data
    const date = new Date()
    this.setState(
      state => ({ data, error: undefined, messages: state.messages.concat({ data, date }), updatedAt: date }),
      () => this.props.onMessage && this.props.onMessage(data)
    )
  }

  onError = ({ error }) => {
    if (!this.mounted) return
    const date = new Date()
    this.setState(
      state => ({ error, errors: state.errors.concat({ error, date }), updatedAt: date }),
      () => this.props.onError && this.props.onError(error)
    )
  }

  postMessage = data => {
    const { serializer = x => x } = this.props
    const { postMessage } = this.worker || {}
    if (!postMessage) throw new Error("Worker not initialized")
    if (this.worker.state && this.worker.state !== "activated") return
    this.setState(
      { lastPostAt: new Date() },
      () =>
        this.messageChannel
          ? postMessage.call(this.worker, serializer(data), [this.messageChannel.port2])
          : postMessage.call(this.worker, serializer(data))
    )
  }

  componentDidMount() {
    const { url, options, worker } = this.props
    this.worker = url ? new window.Worker(url, options) : worker.controller || worker

    if ("onmessage" in this.worker) {
      this.worker.onmessage = this.onMessage
      this.worker.onerror = this.onError
    } else {
      this.messageChannel = new window.MessageChannel()
      this.messageChannel.port1.onmessage = this.onMessage
      this.messageChannel.port1.onmessageerror = this.onError
    }

    this.mounted = true
  }

  componentWillUnmount() {
    this.mounted = false
    this.props.worker || this.worker.terminate()
  }

  render() {
    const { children } = this.props
    if (typeof children === "function") {
      return <Provider value={this.state}>{children(this.state)}</Provider>
    }
    if (children !== undefined && children !== null) {
      return <Provider value={this.state}>{children}</Provider>
    }
    return null
  }
}

/**
 * Renders only when no message or error has been received yet
 *
 * @prop {boolean} persist Show until we have data, even when an error occurred
 * @prop {Function|Node} children Function (passing state) or React node
 */
WebWorker.Pending = ({ children, persist }) => (
  <Consumer>
    {state => {
      if (state.data !== undefined) return null
      if (!persist && state.error !== undefined) return null
      return typeof children === "function" ? children(state) : children || null
    }}
  </Consumer>
)

/**
 * Renders only when worker has sent a message with data
 *
 * @prop {Function|Node} children Function (passing data and state) or React node
 */
WebWorker.Data = ({ children }) => (
  <Consumer>
    {state => {
      if (state.data === undefined) return null
      return typeof children === "function" ? children(state.data, state) : children || null
    }}
  </Consumer>
)

/**
 * Renders only when worker has sent an error
 *
 * @prop {Function|Node} children Function (passing error and state) or React node
 */
WebWorker.Error = ({ children }) => (
  <Consumer>
    {state => {
      if (state.error === undefined) return null
      return typeof children === "function" ? children(state.error, state) : children || null
    }}
  </Consumer>
)

export default WebWorker
