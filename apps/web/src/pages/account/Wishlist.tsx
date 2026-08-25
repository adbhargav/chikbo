import { useWishlist, useWishlistMutations } from '../../lib/queries';
import { usePageMeta } from '../../lib/usePageMeta';
import { useToast } from '../../lib/toast';
import { ApiError } from '../../lib/api';
import { ProductCard, ProductCardSkeleton } from '../../components/ProductCard';
import { EmptyState, ErrorState } from '../../components/ui';
import { CloseIcon } from '../../components/icons';

export default function Wishlist() {
  usePageMeta('Wishlist', 'Products you have saved for later.');
  const wishlist = useWishlist();
  const { remove } = useWishlistMutations();
  const toast = useToast();

  if (wishlist.isPending) {
    return (
      <div className="product-grid" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (wishlist.isError) return <ErrorState onRetry={() => wishlist.refetch()} />;

  const items = wishlist.data;

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your wishlist is empty"
        body="Tap the heart on anything you love and it will wait for you here."
        cta={{ label: 'Discover pieces', to: '/' }}
      />
    );
  }

  return (
    <div className="account-stack">
      <h2>Wishlist</h2>
      <div className="product-grid">
        {items.map((product) => (
          <div key={product.id} className="wishlist-cell">
            <ProductCard product={product} />
            <button
              type="button"
              className="icon-btn wishlist-remove"
              aria-label={`Remove ${product.name} from wishlist`}
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(product.id, {
                  onSuccess: () => toast.show(`Removed ${product.name} from wishlist.`, 'info'),
                  onError: (err) =>
                    toast.show(err instanceof ApiError ? err.message : 'Could not remove item.', 'error'),
                })
              }
            >
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
