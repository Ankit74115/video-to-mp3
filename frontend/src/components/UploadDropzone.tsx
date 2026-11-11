import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { config, maxUploadBytes } from '../api/config'
import type { UploadResult } from '../api/types'
import { useUpload } from '../hooks/useUpload'
import { formatBytes } from '../lib/format'
import { looksLikeVideo } from '../lib/video'
import { Button } from './Button'
import { FileGlyph } from './FileGlyph'
import { Icon } from './Icon'
import { ProgressBar } from './ProgressBar'

interface UploadDropzoneProps {
  onUploaded: (result: UploadResult, file: File) => void
  onUploadError: (message: string, file: File) => void
}

export function UploadDropzone({ onUploaded, onUploadError }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const { state, start, cancel, reset } = useUpload({ onSuccess: onUploaded, onError: onUploadError })

  const busy = state.phase === 'uploading'

  const choose = (candidate: File | undefined) => {
    if (!candidate || busy) return
    if (!looksLikeVideo(candidate)) {
      setPickError(`“${candidate.name}” does not look like a video file.`)
      return
    }
    if (candidate.size > maxUploadBytes) {
      setPickError(
        `${candidate.name} is ${formatBytes(candidate.size)}. The limit is ${config.maxUploadMb} MB.`,
      )
      return
    }
    setPickError(null)
    reset()
    setFile(candidate)
  }

  const clear = () => {
    setFile(null)
    setPickError(null)
    reset()
    if (inputRef.current) inputRef.current.value = ''
  }

  const openPicker = () => {
    if (!busy) inputRef.current?.click()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openPicker()
    }
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!busy) setDragging(true)
  }
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setDragging(false)
  }
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    choose(e.dataTransfer.files?.[0])
  }

  const progress = state.phase === 'uploading' && state.total > 0 ? state.loaded / state.total : 0
  const pct = Math.round(progress * 100)

  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-surface-raised/85 p-5 shadow-card backdrop-blur-sm sm:p-6">
      <div className="mb-5">
        <h2 id="upload-heading" className="text-[1.375rem] text-ink">
          Upload a video
        </h2>
        <p className="mt-1 text-sm text-ink-muted">We keep the audio and discard the rest.</p>
      </div>

      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-disabled={busy || undefined}
        aria-label="Choose a video file, or drop one here"
        aria-describedby="dropzone-hint"
        onClick={openPicker}
        onKeyDown={onKeyDown}
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`group relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 text-center transition-transform duration-300 ease-spring ${
          busy ? 'cursor-default py-6' : 'cursor-pointer py-9 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]'
        } ${dragging ? 'border-moss-500 bg-moss-50' : 'border-line-strong bg-surface hover:border-moss-300'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          tabIndex={-1}
          className="sr-only"
          onChange={(e) => choose(e.target.files?.[0])}
        />
        <span
          aria-hidden="true"
          className={`grid size-12 place-items-center rounded-2xl shadow-card transition-transform duration-300 ease-spring group-hover:-translate-y-0.5 group-hover:scale-105 ${
            dragging ? 'bg-moss-700 text-white' : 'bg-moss-50 text-moss-700'
          }`}
        >
          <Icon name="upload" className="size-6" />
        </span>
        <span className="text-[0.95rem] font-medium text-ink">
          {dragging ? 'Release to add it' : file ? 'Drop a different video' : 'Drop a video here'}
        </span>
        <span className="text-sm text-ink-muted">
          or{' '}
          <span className="font-medium text-moss-700 underline decoration-moss-200 decoration-2 underline-offset-4">
            browse your files
          </span>
        </span>
        <span id="dropzone-hint" className="text-xs text-ink-muted">
          MP4, MOV, MKV, WebM · up to {config.maxUploadMb} MB
        </span>
      </div>

      {pickError && (
        <p role="alert" className="mt-4 flex items-start gap-2.5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100 ring-inset">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
          <span className="break-words">{pickError}</span>
        </p>
      )}

      {file && (
        <div className="animate-rise mt-4 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <FileGlyph filename={file.name} tone="moss" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-ink-muted">{formatBytes(file.size)}</p>
            </div>
            {!busy && (
              <button
                type="button"
                onClick={clear}
                aria-label="Remove selected file"
                className="grid size-8 shrink-0 place-items-center rounded-full text-ink-muted transition-transform duration-300 ease-spring hover:scale-110 hover:text-ink active:scale-95"
              >
                <Icon name="close" className="size-4" />
              </button>
            )}
          </div>

          {state.phase === 'uploading' && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-moss-700">Uploading…</span>
                <span className="font-mono text-ink-muted tabular-nums">{pct}%</span>
              </div>
              <ProgressBar value={progress} label={`Uploading ${file.name}`} />
              <p className="mt-2 text-xs text-ink-muted">
                {formatBytes(state.loaded)} of {formatBytes(state.total)}
              </p>
            </div>
          )}

          {state.phase === 'success' && (
            <p role="status" className="mt-4 flex items-start gap-2.5 rounded-xl bg-moss-50 px-3.5 py-2.5 text-sm text-moss-800 ring-1 ring-moss-100 ring-inset">
              <Icon name="check" className="mt-0.5 size-4 shrink-0" />
              <span>Queued. Conversion starts shortly and will appear in the list.</span>
            </p>
          )}

          {state.phase === 'error' && (
            <p role="alert" className="mt-4 flex items-start gap-2.5 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 ring-1 ring-rose-100 ring-inset">
              <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
              <span className="break-words">{state.message}</span>
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {state.phase === 'uploading' && (
              <Button variant="secondary" onClick={cancel}>
                Cancel
              </Button>
            )}
            {(state.phase === 'idle' || state.phase === 'error') && (
              <Button onClick={() => start(file)} leadingIcon={<Icon name="upload" className="size-4" />}>
                {state.phase === 'error' ? 'Try again' : 'Convert to MP3'}
              </Button>
            )}
            {state.phase === 'success' && (
              <Button variant="secondary" onClick={clear}>
                Upload another
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
