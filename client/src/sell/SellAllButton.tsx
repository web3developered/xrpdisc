type SellAllButtonProps = {
  disabled?: boolean;
  onClick: () => void;
};

export function SellAllButton({ disabled = false, onClick }: SellAllButtonProps) {
  return (
    <button className="sell-all-button" disabled={disabled} type="button" onClick={onClick}>
      Sell All Assets
    </button>
  );
}

