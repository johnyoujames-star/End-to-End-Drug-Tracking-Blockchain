;; batch-creation.clar
;; Core Smart Contract for Drug Batch Creation in the Pharmaceutical Supply Chain
;; Allows registered manufacturers to create drug batches with immutable metadata

;; Constants
(define-constant ERR-UNAUTHORIZED (err u100))
(define-constant ERR-INVALID-HASH (err u101))
(define-constant ERR-INVALID-PARAM (err u102))
(define-constant ERR-PAUSED (err u103))
(define-constant ERR-ALREADY-EXISTS (err u104))
(define-constant ERR-NOT-MANUFACTURER (err u105))
(define-constant ERR-INVALID-BATCH-ID (err u106))
(define-constant ERR-METADATA-TOO-LONG (err u107))
(define-constant ERR-INVALID-EXPIRY (err u108))
(define-constant ERR-INVALID-NOTES (err u109))
(define-constant ERR-INVALID-PRINCIPAL (err u110))
(define-constant ROLE-MANUFACTURER u1)
(define-constant MAX-METADATA-LEN u500)
(define-constant MAX-INGREDIENTS u10)
(define-constant MAX-NOTES-LEN u200)

;; Data Variables
(define-data-var contract-admin principal tx-sender)
(define-data-var contract-paused bool false)
(define-data-var batch-counter uint u0)

;; Data Maps
(define-map batches
  { batch-id: uint }
  {
    manufacturer: principal,
    batch-hash: (buff 32), ;; SHA-256 hash of batch data
    created-at: uint,
    expiry-date: uint,
    product-name: (string-utf8 100),
    ingredients: (list 10 (string-utf8 50)),
    metadata: (string-utf8 500), ;; Additional details (e.g., lot number, production site)
    active: bool
  }
)

(define-map batch-verifications
  { batch-id: uint }
  {
    verified-by: principal,
    verification-time: uint,
    notes: (string-utf8 200)
  }
)

;; Private Functions
(define-private (is-manufacturer (caller principal))
  ;; Placeholder: Assumes integration with UserRegistry contract to check ROLE-MANUFACTURER
  ;; In practice, this would call the UserRegistry contract's has-role function
  (not (is-eq caller tx-sender)) ;; Mock check for demo; replace with actual role check
)

(define-private (validate-hash (hash (buff 32)))
  (is-eq (len hash) u32)
)

(define-private (validate-ingredients (ingredients (list 10 (string-utf8 50))))
  (and
    (> (len ingredients) u0)
    (<= (len ingredients) MAX-INGREDIENTS)
    (fold (lambda (acc item) (and acc (> (len item) u0))) ingredients true)
  )
)

(define-private (validate-notes (notes (string-utf8 200)))
  (and
    (<= (len notes) MAX-NOTES-LEN)
    (> (len notes) u0)
  )
)

(define-private (validate-principal (principal-to-check principal))
  (not (is-eq principal-to-check (as-contract tx-sender)))
)

(define-private (generate-batch-id)
  (let ((new-id (+ (var-get batch-counter) u1)))
    (var-set batch-counter new-id)
    new-id
  )
)

;; Public Functions
(define-public (create-batch
  (batch-hash (buff 32))
  (product-name (string-utf8 100))
  (expiry-date uint)
  (ingredients (list 10 (string-utf8 50)))
  (metadata (string-utf8 500)))
  (let
    (
      (caller tx-sender)
      (batch-id (generate-batch-id))
    )
    (if (var-get contract-paused)
      ERR-PAUSED
      (begin
        (asserts! (is-manufacturer caller) ERR-NOT-MANUFACTURER)
        (asserts! (validate-hash batch-hash) ERR-INVALID-HASH)
        (asserts! (and (> (len product-name) u0) (validate-ingredients ingredients)) ERR-INVALID-PARAM)
        (asserts! (<= (len metadata) MAX-METADATA-LEN) ERR-METADATA-TOO-LONG)
        (asserts! (> expiry-date block-height) ERR-INVALID-EXPIRY)
        (asserts! (is-none (map-get? batches {batch-id: batch-id})) ERR-ALREADY-EXISTS)
        (map-set batches {batch-id: batch-id}
          {
            manufacturer: caller,
            batch-hash: batch-hash,
            created-at: block-height,
            expiry-date: expiry-date,
            product-name: product-name,
            ingredients: ingredients,
            metadata: metadata,
            active: true
          }
        )
        (print
          {
            event: "batch-created",
            batch-id: batch-id,
            manufacturer: caller,
            product-name: product-name,
            created-at: block-height
          }
        )
        (ok batch-id)
      )
    )
  )
)

(define-public (verify-batch (batch-id uint) (notes (string-utf8 200)))
  (let ((caller tx-sender))
    (if (var-get contract-paused)
      ERR-PAUSED
      (begin
        (asserts! (is-manufacturer caller) ERR-NOT-MANUFACTURER)
        (asserts! (validate-notes notes) ERR-INVALID-NOTES)
        (match (map-get? batches {batch-id: batch-id})
          batch
          (begin
            (map-set batch-verifications {batch-id: batch-id}
              {
                verified-by: caller,
                verification-time: block-height,
                notes: notes
              }
            )
            (print
              {
                event: "batch-verified",
                batch-id: batch-id,
                verified-by: caller,
                at: block-height
              }
            )
            (ok true)
          )
          ERR-INVALID-BATCH-ID
        )
      )
    )
  )
)

(define-public (deactivate-batch (batch-id uint))
  (let ((caller tx-sender))
    (if (var-get contract-paused)
      ERR-PAUSED
      (begin
        (asserts! (or (is-eq caller (var-get contract-admin)) (is-manufacturer caller)) ERR-UNAUTHORIZED)
        (match (map-get? batches {batch-id: batch-id})
          batch
          (begin
            (asserts! (or (is-eq (get manufacturer batch) caller) (is-eq caller (var-get contract-admin))) ERR-UNAUTHORIZED)
            (map-set batches {batch-id: batch-id}
              (merge batch {active: false})
            )
            (print
              {
                event: "batch-deactivated",
                batch-id: batch-id,
                by: caller,
                at: block-height
              }
            )
            (ok true)
          )
          ERR-INVALID-BATCH-ID
        )
      )
    )
  )
)

(define-public (pause-contract)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-admin)) ERR-UNAUTHORIZED)
    (var-set contract-paused true)
    (print {event: "contract-paused", at: block-height})
    (ok true)
  )
)

(define-public (unpause-contract)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-admin)) ERR-UNAUTHORIZED)
    (var-set contract-paused false)
    (print {event: "contract-unpaused", at: block-height})
    (ok true)
  )
)

(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-admin)) ERR-UNAUTHORIZED)
    (asserts! (validate-principal new-admin) ERR-INVALID-PRINCIPAL)
    (var-set contract-admin new-admin)
    (print {event: "admin-transferred", new-admin: new-admin, at: block-height})
    (ok true)
  )
)

;; Read-Only Functions
(define-read-only (get-batch-details (batch-id uint))
  (map-get? batches {batch-id: batch-id})
)

(define-read-only (get-batch-verification (batch-id uint))
  (map-get? batch-verifications {batch-id: batch-id})
)

(define-read-only (is-contract-paused)
  (var-get contract-paused)
)

(define-read-only (get-batch-counter)
  (var-get batch-counter)
)