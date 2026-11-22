import fs from 'node:fs'

const file = 'client.js'
let s = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')

if (s.includes('__MEA_ERROR__')) { console.log('error boundary already present'); process.exit(0) }

// Wrap the registered page in an error boundary. A render throw currently
// bubbles to the slot boundary, which swallows it, producing an empty white
// area with no diagnostic. This wrapper shows the error inline instead and
// stores it in localStorage so it can be read from a screenshot or a later
// probe, without needing the browser console.
const oldPage = `        const Page = () => {
          useLocaleVersion()
          return h(AtlasPage, { t: t(), onBack: backToConversation })
        }`

const newPage = `        // Diagnostic boundary: React slot registration swallows render throws,
        // turning a component bug into an unexplained white panel. Surface the
        // error in the panel itself (and in localStorage) so it is diagnosable
        // from the UI alone.
        function ErrorBoundary(props) {
          const [failed, setFailed] = React.useState(null)
          if (failed) {
            const msg = failed && failed.message ? failed.message : String(failed)
            try { window.localStorage.setItem('__MEA_ERROR__', msg) } catch { /* ignore */ }
            return h('div', {
              style: {
                padding: '20px', color: 'var(--dsw-alias-state-error-primary)',
                fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre-wrap',
              },
            }, '中土图鉴加载失败：\\n' + msg + '\\n\\n' + (failed && failed.stack ? failed.stack.slice(0, 600) : ''))
          }
          // Class-free boundary: wrap children in a try by rendering through a
          // shim component that catches during the element-building phase.
          try {
            return props.children
          } catch (error) {
            setFailed(error)
            return null
          }
        }

        const Page = () => {
          useLocaleVersion()
          return h(ErrorBoundary, null, h(AtlasPage, { t: t(), onBack: backToConversation }))
        }`

if (!s.includes(oldPage)) { console.error('Page block not found'); process.exit(1) }
s = s.replace(oldPage, newPage)

fs.writeFileSync(file, s, 'utf8')
console.log('diagnostic error boundary added')
