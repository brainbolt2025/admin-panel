export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export const APPROVAL_STATUS = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
} as const satisfies Record<ApprovalStatus, ApprovalStatus>

export function normalizeApprovalStatus(
  value: ApprovalStatus | boolean | string | null | undefined
): ApprovalStatus {
  if (value === true || value === 'approved') return 'approved'
  if (value === 'rejected') return 'rejected'
  return 'pending'
}

export function isApproved(
  value: ApprovalStatus | boolean | string | null | undefined
): boolean {
  return normalizeApprovalStatus(value) === 'approved'
}

export function isPending(
  value: ApprovalStatus | boolean | string | null | undefined
): boolean {
  return normalizeApprovalStatus(value) === 'pending'
}

export function isRejected(
  value: ApprovalStatus | boolean | string | null | undefined
): boolean {
  return normalizeApprovalStatus(value) === 'rejected'
}

export function approvalStatusLabel(status: ApprovalStatus): string {
  switch (status) {
    case 'approved':
      return 'Approved'
    case 'rejected':
      return 'Rejected'
    default:
      return 'Pending'
  }
}
