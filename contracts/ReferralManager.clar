(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-NEEDS u101)
(define-constant ERR-INVALID-LANGUAGE u102)
(define-constant ERR-INVALID-EXPERTISE u103)
(define-constant ERR-INVALID-PRIORITY u104)
(define-constant ERR-REFERRAL-ALREADY-EXISTS u105)
(define-constant ERR-REFERRAL-NOT-FOUND u106)
(define-constant ERR-INVALID-STATUS u107)
(define-constant ERR-INVALID-TIMESTAMP u108)
(define-constant ERR-COUNSELOR-NOT-VERIFIED u109)
(define-constant ERR-VICTIM-NOT-REGISTERED u110)
(define-constant ERR-MATCHING-FAILED u111)
(define-constant ERR-STATUS-UPDATE-NOT-ALLOWED u112)
(define-constant ERR-INVALID-UPDATE-REASON u113)
(define-constant ERR-MAX-REFERRALS-EXCEEDED u114)
(define-constant ERR-INVALID-ANONYMITY-LEVEL u115)
(define-constant ERR-INVALID-LOCATION u116)
(define-constant ERR-INVALID-AVAILABILITY u117)
(define-constant ERR-INVALID-FOLLOWUP u118)
(define-constant ERR-INVALID-FEEDBACK u119)
(define-constant ERR-EMERGENCY-FLAG-NOT-ALLOWED u120)
(define-constant ERR-INVALID-REFERRAL-TYPE u121)
(define-constant ERR-INVALID-DURATION u122)
(define-constant ERR-INVALID-COST u123)
(define-constant ERR-INVALID-PAYMENT_STATUS u124)
(define-constant ERR-INSUFFICIENT-BALANCE u125)
(define-constant ERR-TRANSFER-FAILED u126)

(define-data-var referral-counter uint u0)
(define-data-var max-referrals uint u10000)
(define-data-var creation-fee uint u500)
(define-data-var admin-principal principal tx-sender)

(define-map referrals
  uint
  {
    victim-id: principal,
    counselor-id: (optional principal),
    status: (string-ascii 20),
    created-at: uint,
    needs: (string-utf8 500),
    language: (string-ascii 50),
    expertise: (string-ascii 100),
    priority: uint,
    anonymity-level: uint,
    location: (string-ascii 100),
    availability: (string-ascii 100),
    followup-required: bool,
    feedback-score: (optional uint),
    emergency-flag: bool,
    referral-type: (string-ascii 50),
    duration: uint,
    cost: uint,
    payment-status: (string-ascii 20)
  }
)

(define-map referrals-by-victim
  principal
  (list 100 uint)
)

(define-map referral-updates
  uint
  {
    update-status: (string-ascii 20),
    update-timestamp: uint,
    updater: principal,
    update-reason: (string-utf8 500)
  }
)

(define-read-only (get-referral (id uint))
  (map-get? referrals id)
)

(define-read-only (get-referral-updates (id uint))
  (map-get? referral-updates id)
)

(define-read-only (get-referrals-by-victim (victim principal))
  (default-to (list) (map-get? referrals-by-victim victim))
)

(define-read-only (get-referral-count)
  (ok (var-get referral-counter))
)

(define-private (validate-needs (n (string-utf8 500)))
  (if (> (len n) u0)
      (ok true)
      (err ERR-INVALID-NEEDS))
)

(define-private (validate-language (l (string-ascii 50)))
  (if (or (is-eq l "english") (is-eq l "spanish") (is-eq l "french") (is-eq l "other"))
      (ok true)
      (err ERR-INVALID-LANGUAGE))
)

(define-private (validate-expertise (e (string-ascii 100)))
  (if (> (len e) u0)
      (ok true)
      (err ERR-INVALID-EXPERTISE))
)

(define-private (validate-priority (p uint))
  (if (and (>= p u1) (<= p u5))
      (ok true)
      (err ERR-INVALID-PRIORITY))
)

(define-private (validate-anonymity-level (a uint))
  (if (and (>= a u0) (<= a u3))
      (ok true)
      (err ERR-INVALID-ANONYMITY-LEVEL))
)

(define-private (validate-location (loc (string-ascii 100)))
  (if (> (len loc) u0)
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-availability (av (string-ascii 100)))
  (if (> (len av) u0)
      (ok true)
      (err ERR-INVALID-AVAILABILITY))
)

(define-private (validate-referral-type (rt (string-ascii 50)))
  (if (or (is-eq rt "trauma") (is-eq rt "anxiety") (is-eq rt "depression") (is-eq rt "other"))
      (ok true)
      (err ERR-INVALID-REFERRAL-TYPE))
)

(define-private (validate-duration (d uint))
  (if (and (>= d u15) (<= d u120))
      (ok true)
      (err ERR-INVALID-DURATION))
)

(define-private (validate-cost (c uint))
  (if (<= c u10000)
      (ok true)
      (err ERR-INVALID-COST))
)

(define-private (validate-payment-status (ps (string-ascii 20)))
  (if (or (is-eq ps "pending") (is-eq ps "paid") (is-eq ps "waived"))
      (ok true)
      (err ERR-INVALID-PAYMENT_STATUS))
)

(define-private (validate-status (s (string-ascii 20)))
  (if (or (is-eq s "open") (is-eq s "accepted") (is-eq s "in-progress") (is-eq s "completed") (is-eq s "closed") (is-eq s "rejected"))
      (ok true)
      (err ERR-INVALID-STATUS))
)

(define-private (validate-feedback (f uint))
  (if (and (>= f u1) (<= f u5))
      (ok true)
      (err ERR-INVALID-FEEDBACK))
)

(define-private (validate-update-reason (r (string-utf8 500)))
  (if (> (len r) u0)
      (ok true)
      (err ERR-INVALID-UPDATE-REASON))
)

(define-public (set-max-referrals (new-max uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (var-set max-referrals new-max)
    (ok true))
)

(define-public (set-creation-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (var-set creation-fee new-fee)
    (ok true))
)

(define-public (set-admin-principal (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (var-set admin-principal new-admin)
    (ok true))
)

(define-public (create-referral
  (victim-id principal)
  (needs (string-utf8 500))
  (language (string-ascii 50))
  (expertise (string-ascii 100))
  (priority uint)
  (anonymity-level uint)
  (location (string-ascii 100))
  (availability (string-ascii 100))
  (followup-required bool)
  (emergency-flag bool)
  (referral-type (string-ascii 50))
  (duration uint)
  (cost uint)
  (payment-status (string-ascii 20)))
  (let (
        (next-id (var-get referral-counter))
        (current-max (var-get max-referrals))
        (victim-check (contract-call? .UserRegistry verify-user victim-id "victim"))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-REFERRALS-EXCEEDED))
    (try! (validate-needs needs))
    (try! (validate-language language))
    (try! (validate-expertise expertise))
    (try! (validate-priority priority))
    (try! (validate-anonymity-level anonymity-level))
    (try! (validate-location location))
    (try! (validate-availability availability))
    (try! (validate-referral-type referral-type))
    (try! (validate-duration duration))
    (try! (validate-cost cost))
    (try! (validate-payment-status payment-status))
    (asserts! (is-ok victim-check) (err ERR-VICTIM-NOT-REGISTERED))
    (map-set referrals next-id
      {
        victim-id: victim-id,
        counselor-id: none,
        status: "open",
        created-at: block-height,
        needs: needs,
        language: language,
        expertise: expertise,
        priority: priority,
        anonymity-level: anonymity-level,
        location: location,
        availability: availability,
        followup-required: followup-required,
        feedback-score: none,
        emergency-flag: emergency-flag,
        referral-type: referral-type,
        duration: duration,
        cost: cost,
        payment-status: payment-status
      })
    (let ((victim-list (default-to (list) (map-get? referrals-by-victim victim-id))))
      (map-set referrals-by-victim victim-id (append victim-list next-id)))
    (var-set referral-counter (+ next-id u1))
    (print { event: "referral-created", id: next-id, victim: victim-id })
    (ok next-id))
)

(define-public (accept-referral (referral-id uint) (counselor-id principal))
  (let (
        (referral (unwrap! (map-get? referrals referral-id) (err ERR-REFERRAL-NOT-FOUND)))
        (counselor-check (contract-call? .CounselorVerifier verify-counselor counselor-id))
        (match-result (contract-call? .MatchingEngine log-match referral-id counselor-id))
      )
    (asserts! (is-eq (get status referral) "open") (err ERR-INVALID-STATUS))
    (asserts! (is-ok counselor-check) (err ERR-COUNSELOR-NOT-VERIFIED))
    (asserts! (is-ok match-result) (err ERR-MATCHING-FAILED))
    (map-set referrals referral-id
      (merge referral { counselor-id: (some counselor-id), status: "accepted" }))
    (map-set referral-updates referral-id
      {
        update-status: "accepted",
        update-timestamp: block-height,
        updater: tx-sender,
        update-reason: "Counselor accepted the referral"
      })
    (print { event: "referral-accepted", id: referral-id, counselor: counselor-id })
    (ok true))
)

(define-public (update-referral-status (referral-id uint) (new-status (string-ascii 20)) (reason (string-utf8 500)))
  (let (
        (referral (unwrap! (map-get? referrals referral-id) (err ERR-REFERRAL-NOT-FOUND)))
      )
    (asserts! (or (is-eq tx-sender (get victim-id referral)) (is-eq tx-sender (default-to tx-sender (get counselor-id referral)))) (err ERR-NOT-AUTHORIZED))
    (try! (validate-status new-status))
    (try! (validate-update-reason reason))
    (asserts! (not (is-eq (get status referral) new-status)) (err ERR-STATUS-UPDATE-NOT-ALLOWED))
    (map-set referrals referral-id
      (merge referral { status: new-status }))
    (map-set referral-updates referral-id
      {
        update-status: new-status,
        update-timestamp: block-height,
        updater: tx-sender,
        update-reason: reason
      })
    (print { event: "referral-status-updated", id: referral-id, new-status: new-status })
    (ok true))
)

(define-public (provide-feedback (referral-id uint) (score uint))
  (let (
        (referral (unwrap! (map-get? referrals referral-id) (err ERR-REFERRAL-NOT-FOUND)))
      )
    (asserts! (is-eq tx-sender (get victim-id referral)) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-eq (get status referral) "completed") (err ERR-INVALID-STATUS))
    (try! (validate-feedback score))
    (map-set referrals referral-id
      (merge referral { feedback-score: (some score) }))
    (print { event: "feedback-provided", id: referral-id, score: score })
    (ok true))
)

(define-public (close-referral (referral-id uint) (reason (string-utf8 500)))
  (let (
        (referral (unwrap! (map-get? referrals referral-id) (err ERR-REFERRAL-NOT-FOUND)))
      )
    (asserts! (or (is-eq tx-sender (get victim-id referral)) (is-eq tx-sender (default-to tx-sender (get counselor-id referral)))) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq (get status referral) "closed")) (err ERR-INVALID-STATUS))
    (try! (validate-update-reason reason))
    (map-set referrals referral-id
      (merge referral { status: "closed" }))
    (map-set referral-updates referral-id
      {
        update-status: "closed",
        update-timestamp: block-height,
        updater: tx-sender,
        update-reason: reason
      })
    (print { event: "referral-closed", id: referral-id })
    (ok true))
)

(define-public (reject-referral (referral-id uint) (reason (string-utf8 500)))
  (let (
        (referral (unwrap! (map-get? referrals referral-id) (err ERR-REFERRAL-NOT-FOUND)))
      )
    (asserts! (is-eq tx-sender (default-to tx-sender (get counselor-id referral))) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-eq (get status referral) "accepted") (err ERR-INVALID-STATUS))
    (try! (validate-update-reason reason))
    (map-set referrals referral-id
      (merge referral { status: "rejected", counselor-id: none }))
    (map-set referral-updates referral-id
      {
        update-status: "rejected",
        update-timestamp: block-height,
        updater: tx-sender,
        update-reason: reason
      })
    (print { event: "referral-rejected", id: referral-id })
    (ok true))
)

(define-public (start-session (referral-id uint))
  (let (
        (referral (unwrap! (map-get? referrals referral-id) (err ERR-REFERRAL-NOT-FOUND)))
        (session-result (contract-call? .SessionTracker log-session-start referral-id))
      )
    (asserts! (is-eq (get status referral) "accepted") (err ERR-INVALID-STATUS))
    (asserts! (is-some (get counselor-id referral)) (err ERR-COUNSELOR-NOT-VERIFIED))
    (asserts! (is-ok session-result) (err ERR_MATCHING-FAILED))
    (map-set referrals referral-id
      (merge referral { status: "in-progress" }))
    (print { event: "session-started", id: referral-id })
    (ok true))
)

(define-public (complete-session (referral-id uint))
  (let (
        (referral (unwrap! (map-get? referrals referral-id) (err ERR-REFERRAL-NOT-FOUND)))
        (session-result (contract-call? .SessionTracker log-session-complete referral-id))
      )
    (asserts! (is-eq (get status referral) "in-progress") (err ERR-INVALID-STATUS))
    (asserts! (is-ok session-result) (err ERR_MATCHING-FAILED))
    (map-set referrals referral-id
      (merge referral { status: "completed" }))
    (print { event: "session-completed", id: referral-id })
    (ok true))
)

(define-public (pay-referral-fee (referral-id uint))
  (let (
        (referral (unwrap! (map-get? referrals referral-id) (err ERR-REFERRAL-NOT-FOUND)))
        (fee (get cost referral))
      )
    (asserts! (is-eq tx-sender (get victim-id referral)) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-eq (get payment-status referral) "pending") (err ERR-INVALID_PAYMENT_STATUS))
    (try! (stx-transfer? fee tx-sender (as-contract tx-sender)))
    (map-set referrals referral-id
      (merge referral { payment-status: "paid" }))
    (print { event: "fee-paid", id: referral-id, amount: fee })
    (ok true))
)

(define-public (waive-fee (referral-id uint))
  (let (
        (referral (unwrap! (map-get? referrals referral-id) (err ERR-REFERRAL-NOT-FOUND)))
      )
    (asserts! (is-eq tx-sender (default-to tx-sender (get counselor-id referral))) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-eq (get payment-status referral) "pending") (err ERR-INVALID_PAYMENT_STATUS))
    (map-set referrals referral-id
      (merge referral { payment-status: "waived" }))
    (print { event: "fee-waived", id: referral-id })
    (ok true))
)