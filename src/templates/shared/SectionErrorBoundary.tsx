"use client";

import { Component, type ReactNode } from "react";

/** Client retries after a failed streaming SSR section must also stay isolated. */
export class SectionErrorBoundary extends Component<{ sectionType: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { console.error("Hosted section failed:", this.props.sectionType); }
  render() { return this.state.failed ? null : this.props.children; }
}
