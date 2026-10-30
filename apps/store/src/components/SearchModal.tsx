/**
 * SearchModal - re-exports SearchDropdown for backwards compatibility.
 * Search now operates directly as an attached liquid glass dropdown in the TopBar
 * rather than an intrusive pop-up dialog window.
 */
export { SearchDropdown as SearchModal, SearchDropdown } from "./SearchDropdown";
export type { SearchDropdownProps as SearchModalProps } from "./SearchDropdown";
