import {
  mdiArrowDown,
  mdiArrowUp,
  mdiDeleteOutline,
  mdiDotsVertical,
  mdiEyeOffOutline,
  mdiEyeOutline,
  mdiListBoxOutline,
  mdiPencilOutline,
  mdiPlus,
  mdiShapeOutline,
} from "@mdi/js";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Snackbar from "@mui/material/Snackbar";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  addPresetCategories,
  deleteCategory,
  reorderCategories,
  updateCategory,
  type Category,
  type CategoryType,
} from "@/api/categories";
import { errorMessage } from "@/api/client";
import { CategoryIcon } from "@/components/CategoryIcon";
import { MdiIcon } from "@/components/MdiIcon";
import { CategoryDialog, type CategoryDialogTarget } from "@/pages/categories/CategoryDialog";
import { CATEGORIES_KEY, invalidateCategories, useCategories } from "@/pages/transactions/queries";

const TYPES: { value: CategoryType; name: string }[] = [
  { value: "expense", name: "Expense" },
  { value: "income", name: "Income" },
  { value: "transfer", name: "Transfer" },
];

function plural(count: number, word: string, words = `${word}s`): string {
  return `${count} ${count === 1 ? word : words}`;
}

function subCount(count: number): string {
  return plural(count, "sub-category", "sub-categories");
}

interface RowActions {
  onEdit: (category: Category) => void;
  onAddSub: (group: Category) => void;
  onToggleHidden: (category: Category) => void;
  onDelete: (category: Category) => void;
  onMove: (category: Category, siblings: Category[], step: -1 | 1) => void;
  onShowTransactions: (category: Category) => void;
}

/** One category: its icon, name and use, with move buttons and a menu of the rest. */
function CategoryRow({
  category,
  siblings,
  index,
  isGroup,
  busy,
  actions,
}: {
  category: Category;
  siblings: Category[];
  index: number;
  isGroup: boolean;
  busy: boolean;
  actions: RowActions;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const subs = category.sub_categories.length;
  const used = category.transaction_count + category.sub_categories.reduce((total, sub) => total + sub.transaction_count, 0);
  const caption = isGroup && subs > 0 ? `${subCount(subs)} · ${plural(used, "transaction")}` : plural(used, "transaction");

  function act(action: () => void): void {
    setAnchor(null);
    action();
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        pl: isGroup ? { xs: 1, sm: 2 } : { xs: 5, sm: 7 },
        pr: 1,
        py: isGroup ? 1 : 0.5,
        bgcolor: isGroup ? "action.hover" : "transparent",
        "@media (hover: hover)": {
          "& .category-row__move": { opacity: 0, transition: "opacity 120ms ease" },
          "&:hover .category-row__move, &:focus-within .category-row__move": { opacity: 1 },
        },
      }}
    >
      <ButtonBase
        onClick={() => actions.onEdit(category)}
        sx={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "flex-start", alignItems: "center", gap: 1.5, py: 0.75, px: 1, borderRadius: 1, textAlign: "start" }}
      >
        <Box sx={{ opacity: category.hidden ? 0.45 : 1, display: "flex" }}>
          <CategoryIcon icon={category.icon} color={category.color} size={isGroup ? 24 : 20} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: isGroup ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: category.hidden ? 0.6 : 1 }}>
            {category.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {caption}
          </Typography>
        </Box>
        {category.hidden ? <Chip size="small" variant="outlined" label="Hidden" sx={{ ml: 0.5 }} /> : null}
      </ButtonBase>

      <Box className="category-row__move" sx={{ display: "flex", flex: "none" }}>
        <Tooltip title="Move up">
          <span>
            <IconButton size="small" aria-label={`Move ${category.name} up`} disabled={busy || index === 0} onClick={() => actions.onMove(category, siblings, -1)}>
              <MdiIcon path={mdiArrowUp} fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Move down">
          <span>
            <IconButton size="small" aria-label={`Move ${category.name} down`} disabled={busy || index === siblings.length - 1} onClick={() => actions.onMove(category, siblings, 1)}>
              <MdiIcon path={mdiArrowDown} fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <Tooltip title="More">
        <IconButton size="small" aria-label={`More for ${category.name}`} disabled={busy} onClick={(event) => setAnchor(event.currentTarget)}>
          <MdiIcon path={mdiDotsVertical} fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={() => act(() => actions.onEdit(category))}>
          <ListItemIcon>
            <MdiIcon path={mdiPencilOutline} fontSize="small" />
          </ListItemIcon>
          Edit
        </MenuItem>
        {isGroup ? (
          <MenuItem onClick={() => act(() => actions.onAddSub(category))}>
            <ListItemIcon>
              <MdiIcon path={mdiPlus} fontSize="small" />
            </ListItemIcon>
            Add Sub-category
          </MenuItem>
        ) : null}
        <MenuItem onClick={() => act(() => actions.onShowTransactions(category))}>
          <ListItemIcon>
            <MdiIcon path={mdiListBoxOutline} fontSize="small" />
          </ListItemIcon>
          Show Transactions
        </MenuItem>
        <MenuItem onClick={() => act(() => actions.onToggleHidden(category))}>
          <ListItemIcon>
            <MdiIcon path={category.hidden ? mdiEyeOutline : mdiEyeOffOutline} fontSize="small" />
          </ListItemIcon>
          {category.hidden ? "Show" : "Hide"}
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => act(() => actions.onDelete(category))} sx={{ color: "error.main" }}>
          <ListItemIcon sx={{ color: "inherit" }}>
            <MdiIcon path={mdiDeleteOutline} fontSize="small" />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
}

/** Manage categories: one type at a time, each group with its sub-categories. Like ezBookkeeping's category list. */
export function CategoriesPage() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const categories = useCategories();
  const [params, setParams] = useSearchParams();
  const type: CategoryType = TYPES.some((option) => option.value === params.get("type")) ? (params.get("type") as CategoryType) : "expense";
  const [dialog, setDialog] = useState<CategoryDialogTarget | null>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const all = categories.data ?? [];
  const groups = all.filter((category) => category.type === type);
  const onError = (error: unknown) => setMessage(errorMessage(error));

  const toggleHidden = useMutation({
    mutationFn: (category: Category) => updateCategory(category.id, { hidden: !category.hidden }),
    onSuccess: async (category) => {
      await invalidateCategories(client);
      setMessage(category.hidden ? `${category.name} is hidden from new transactions` : `${category.name} is shown again`);
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (category: Category) => deleteCategory(category.id),
    onSuccess: async () => {
      setToDelete(null);
      await invalidateCategories(client);
      setMessage("Category deleted");
    },
    onError: (error) => {
      setToDelete(null);
      onError(error);
    },
  });

  const move = useMutation({
    mutationFn: ({ category, siblings, step }: { category: Category; siblings: Category[]; step: -1 | 1 }) => {
      const ids = siblings.map((sibling) => sibling.id);
      const from = ids.indexOf(category.id);
      ids.splice(from, 1);
      ids.splice(from + step, 0, category.id);
      return reorderCategories(category.type, category.parent_id, ids);
    },
    onSuccess: (tree) => client.setQueryData([CATEGORIES_KEY], tree),
    onError,
  });

  const presets = useMutation({
    mutationFn: addPresetCategories,
    onSuccess: async () => {
      await invalidateCategories(client);
      setMessage("Preset categories added");
    },
    onError,
  });

  const busy = toggleHidden.isPending || remove.isPending || move.isPending;
  const actions: RowActions = {
    onEdit: (category) => setDialog({ mode: "edit", category }),
    onAddSub: (group) => setDialog({ mode: "add", type: group.type, parent: group }),
    onToggleHidden: (category) => toggleHidden.mutate(category),
    onDelete: setToDelete,
    onMove: (category, siblings, step) => move.mutate({ category, siblings, step }),
    onShowTransactions: (category) => void navigate(`/transactions?type=${category.type}&category=${category.id}`),
  };

  const deleteUsed = toDelete ? toDelete.transaction_count + toDelete.sub_categories.reduce((total, sub) => total + sub.transaction_count, 0) : 0;

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2.5, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" component="h1">
            Categories
          </Typography>
          <Typography variant="body2" color="text.secondary">
            How your transactions are grouped. Click a category to edit it.
          </Typography>
        </Box>
        <Button startIcon={<MdiIcon path={mdiPlus} />} disabled={!categories.isSuccess} onClick={() => setDialog({ mode: "add", type, parent: null })}>
          Add Category
        </Button>
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
        <Tabs value={type} onChange={(_, value: CategoryType) => setParams(value === "expense" ? {} : { type: value }, { replace: true })} sx={{ px: { xs: 1, sm: 2 }, borderBottom: 1, borderColor: "divider" }}>
          {TYPES.map((option) => {
            const count = all.filter((category) => category.type === option.value).length;
            return <Tab key={option.value} value={option.value} label={categories.isSuccess ? `${option.name} (${count})` : option.name} sx={{ textTransform: "none", fontWeight: 500 }} />;
          })}
        </Tabs>

        {categories.isPending ? (
          <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} variant="rounded" height={44} />
            ))}
          </Box>
        ) : categories.isError ? (
          <Box sx={{ p: 3 }}>
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => void categories.refetch()}>
                  Retry
                </Button>
              }
            >
              Could not load your categories. {errorMessage(categories.error)}
            </Alert>
          </Box>
        ) : groups.length === 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 1.5, py: 8, px: 2, color: "text.secondary" }}>
            <MdiIcon path={mdiShapeOutline} sx={{ fontSize: 44 }} />
            <Typography>{all.length === 0 ? "You have no categories yet. Start with the presets (Food, Transport, Salary and more), or make your own." : `No ${type} categories yet.`}</Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
              {all.length === 0 ? (
                <Button disabled={presets.isPending} onClick={() => presets.mutate()}>
                  Add Preset Categories
                </Button>
              ) : null}
              <Button variant={all.length === 0 ? "outlined" : "contained"} startIcon={<MdiIcon path={mdiPlus} />} onClick={() => setDialog({ mode: "add", type, parent: null })}>
                Add Category
              </Button>
            </Box>
          </Box>
        ) : (
          groups.map((group, index) => (
            <Box key={group.id} component="section" sx={{ borderTop: index === 0 ? 0 : 1, borderColor: "divider" }}>
              <CategoryRow category={group} siblings={groups} index={index} isGroup busy={busy} actions={actions} />
              {group.sub_categories.map((sub, subIndex) => (
                <CategoryRow key={sub.id} category={sub} siblings={group.sub_categories} index={subIndex} isGroup={false} busy={busy} actions={actions} />
              ))}
              <Box sx={{ pl: { xs: 5, sm: 7 }, pb: 1, pt: group.sub_categories.length ? 0 : 0.5 }}>
                <Button size="small" variant="text" startIcon={<MdiIcon path={mdiPlus} />} disabled={busy} onClick={() => actions.onAddSub(group)}>
                  Add Sub-category
                </Button>
              </Box>
            </Box>
          ))
        )}
      </Paper>

      {dialog ? (
        <CategoryDialog
          target={dialog}
          groups={all.filter((category) => category.type === (dialog.mode === "edit" ? dialog.category.type : dialog.type))}
          onClose={() => setDialog(null)}
          onSaved={setMessage}
        />
      ) : null}

      <Dialog open={toDelete !== null} onClose={remove.isPending ? undefined : () => setToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete {toDelete?.name}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteUsed > 0
              ? `It has ${plural(deleteUsed, "transaction")}, so it cannot be deleted. Change their category first, or hide it instead.`
              : toDelete && toDelete.sub_categories.length > 0
                ? `Its ${subCount(toDelete.sub_categories.length)} will be deleted too. This cannot be undone.`
                : "This cannot be undone."}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="text" color="inherit" disabled={remove.isPending} onClick={() => setToDelete(null)}>
            {deleteUsed > 0 ? "Close" : "Cancel"}
          </Button>
          {deleteUsed > 0 ? (
            <Button
              onClick={() => {
                if (toDelete) toggleHidden.mutate(toDelete);
                setToDelete(null);
              }}
              disabled={toDelete?.hidden}
            >
              Hide It
            </Button>
          ) : (
            <Button color="error" disabled={remove.isPending} onClick={() => toDelete && remove.mutate(toDelete)}>
              Delete
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar open={message !== null} message={message} autoHideDuration={3500} onClose={() => setMessage(null)} />
    </>
  );
}
