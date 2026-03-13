import { Component, type ReactNode } from "react"
import { ErrorBoundaryUI } from "./ErrorBoundaryUI"
import { logError } from "@/lib/error-logger"

interface Props {
  children: ReactNode
  context?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    logError(error, this.props.context ?? "Unknown")
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorBoundaryUI
          error={this.state.error}
          reset={() => this.setState({ error: null })}
          context={this.props.context ?? "Unknown"}
        />
      )
    }
    return this.props.children
  }
}
