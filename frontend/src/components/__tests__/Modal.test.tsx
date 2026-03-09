import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Modal, ModalActions, ModalFormActions } from '../Modal'

describe('Modal Component', () => {
  describe('Modal', () => {
    it('should render when isOpen is true', () => {
      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
        >
          Test content
        </Modal>
      )

      expect(screen.getByText('Test Modal')).toBeInTheDocument()
      expect(screen.getByText('Test content')).toBeInTheDocument()
    })

    it('should not render when isOpen is false', () => {
      render(
        <Modal
          isOpen={false}
          onClose={vi.fn()}
          title="Test Modal"
        >
          Test content
        </Modal>
      )

      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument()
    })

    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn()
      render(
        <Modal
          isOpen={true}
          onClose={onClose}
          title="Test Modal"
        >
          Test content
        </Modal>
      )

      const closeButton = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalled()
    })

    it('should call onClose when Escape key is pressed', async () => {
      const onClose = vi.fn()
      render(
        <Modal
          isOpen={true}
          onClose={onClose}
          title="Test Modal"
        >
          Test content
        </Modal>
      )

      fireEvent.keyDown(document, { key: 'Escape' })

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled()
      })
    })

    it('should call onClose when backdrop is clicked', () => {
      const onClose = vi.fn()
      const { container } = render(
        <Modal
          isOpen={true}
          onClose={onClose}
          title="Test Modal"
          closeOnBackdropClick={true}
        >
          Test content
        </Modal>
      )

      const backdrop = container.querySelector('[role="presentation"]')
      if (backdrop) {
        fireEvent.click(backdrop)
      }

      expect(onClose).toHaveBeenCalled()
    })

    it('should not close when backdrop is clicked if closeOnBackdropClick is false', () => {
      const onClose = vi.fn()
      const { container } = render(
        <Modal
          isOpen={true}
          onClose={onClose}
          title="Test Modal"
          closeOnBackdropClick={false}
        >
          Test content
        </Modal>
      )

      const backdrop = container.querySelector('[role="presentation"]')
      if (backdrop) {
        fireEvent.click(backdrop)
      }

      expect(onClose).not.toHaveBeenCalled()
    })

    it('should not close when modal content is clicked', () => {
      const onClose = vi.fn()
      render(
        <Modal
          isOpen={true}
          onClose={onClose}
          title="Test Modal"
        >
          <button>Click me</button>
        </Modal>
      )

      fireEvent.click(screen.getByRole('button', { name: /click me/i }))

      expect(onClose).not.toHaveBeenCalled()
    })

    it('should render with different size variants', () => {
      const { rerender, container: container1 } = render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
          size="sm"
        >
          Test content
        </Modal>
      )

      expect(container1.textContent).toContain('Test content')

      rerender(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
          size="lg"
        >
          Test content
        </Modal>
      )

      expect(screen.getByText('Test Modal')).toBeInTheDocument()
    })

    it('should render icon if provided', () => {
      const TestIcon = () => <span data-testid="test-icon">Icon</span>
      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
          icon={<TestIcon />}
        >
          Test content
        </Modal>
      )

      expect(screen.getByTestId('test-icon')).toBeInTheDocument()
    })

    it('should render footer if provided', () => {
      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
          footer={<div>Footer content</div>}
        >
          Test content
        </Modal>
      )

      expect(screen.getByText('Footer content')).toBeInTheDocument()
    })

    it('should have proper accessibility attributes', () => {
      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
        >
          Test content
        </Modal>
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title')
    })

    it('should hide close button when showCloseButton is false', () => {
      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
          showCloseButton={false}
        >
          Test content
        </Modal>
      )

      expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
    })
  })

  describe('ModalActions', () => {
    it('should render children buttons', () => {
      render(
        <ModalActions>
          <button>Cancel</button>
          <button>Save</button>
        </ModalActions>
      )

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    })
  })

  describe('ModalFormActions', () => {
    it('should render cancel and submit buttons', () => {
      render(
        <ModalFormActions
          onCancel={vi.fn()}
          submitLabel="Save"
          cancelLabel="Cancel"
        />
      )

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    })

    it('should call onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn()
      render(
        <ModalFormActions onCancel={onCancel} />
      )

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

      expect(onCancel).toHaveBeenCalled()
    })

    it('should disable submit button when isSubmitting is true', () => {
      render(
        <ModalFormActions
          onCancel={vi.fn()}
          isSubmitting={true}
        />
      )

      const submitButton = screen.getByRole('button', { name: /saving/i })
      expect(submitButton).toBeDisabled()
    })

    it('should show loading text when isSubmitting is true', () => {
      render(
        <ModalFormActions
          onCancel={vi.fn()}
          isSubmitting={true}
        />
      )

      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument()
    })

    it('should disable submit button when isValid is false', () => {
      render(
        <ModalFormActions
          onCancel={vi.fn()}
          isValid={false}
        />
      )

      const submitButton = screen.getByRole('button', { name: /save/i })
      expect(submitButton).toBeDisabled()
    })

    it('should use custom labels', () => {
      render(
        <ModalFormActions
          onCancel={vi.fn()}
          submitLabel="Create"
          cancelLabel="Back"
        />
      )

      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
    })

    it('should disable cancel button when isSubmitting is true', () => {
      render(
        <ModalFormActions
          onCancel={vi.fn()}
          isSubmitting={true}
        />
      )

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      expect(cancelButton).toBeDisabled()
    })
  })
})
