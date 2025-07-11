declare global {
	interface ImportMeta {
		include(path: string): void
	}
}

export {}