import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { createCategory, updateCategory, type Category, type CategoryType } from "@/api/categories";
import { ApiError, errorMessage } from "@/api/client";
import { CATEGORY_ICON_NAMES } from "@/appearance/categoryIcons";
import { CategoryIcon } from "@/components/CategoryIcon";
import { IconColorPicker } from "@/components/IconColorPicker";
import { invalidateCategories } from "@/pages/transactions/queries";

/** A new top-level category, a new sub-category in a group, or a category to edit. */
export type CategoryDialogTarget =
  | { mode: "add"; type: CategoryType; parent: Category | null }
  | { mode: "edit"; category: Category };

const TYPE_WORDS: Record<CategoryType, string> = { expense: "expense", income: "income", transfer: "transfer" };

/** Add or edit a category. Modelled on ezBookkeeping's category edit dialog. */
export function CategoryDialog({
  target,
  groups,
  onClose,
  onSaved,
}: {
  target: CategoryDialogTarget;
  /** The top-level categories of the same type, for choosing a sub-category's group. */
  groups: Category[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const client = useQueryClient();
  const editing = target.mode === "edit" ? target.category : null;
  const parentId = editing ? editing.parent_id : target.mode === "add" ? (target.parent?.id ?? null) : null;
  const type = editing ? editing.type : target.mode === "add" ? target.type : "expense";
  const isSub = parentId !== null;
  // A new sub-category starts in its group's colour, as the presets do.
  const startColor = editing ? editing.color : target.mode === "add" ? (target.parent?.color ?? null) : null;
  const startIcon = editing ? editing.icon : target.mode === "add" && target.parent ? target.parent.icon : "shape-outline";

  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState(startIcon);
  const [color, setColor] = useState<string | null>(startColor);
  const [group, setGroup] = useState<number | null>(parentId);
  const [visible, setVisible] = useState(!(editing?.hidden ?? false));
  const [serverError, setServerError] = useState<ApiError | null>(null);

  const save = useMutation({
    mutationFn: () =>
      editing
        ? updateCategory(editing.id, {
            name: name.trim(),
            icon,
            color,
            hidden: !visible,
            ...(isSub && group !== null && group !== editing.parent_id ? { parent_id: group } : {}),
          })
        : createCategory({ type, parent_id: group, name: name.trim(), icon, color }),
    onSuccess: async () => {
      await invalidateCategories(client);
      onSaved(editing ? "Category saved" : "Category added");
      onClose();
    },
    onError: (error) => setServerError(error instanceof ApiError ? error : new ApiError(0, "error", errorMessage(error))),
  });

  const busy = save.isPending;
  const canSave = name.trim() !== "" && !busy;
  const title = editing ? (isSub ? "Edit Sub-category" : "Edit Category") : isSub ? "Add Sub-category" : `Add ${TYPE_WORDS[type][0]!.toUpperCase()}${TYPE_WORDS[type].slice(1)} Category`;

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box
          component="form"
          id="category-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave) save.mutate();
          }}
          sx={{ display: "flex", flexDirection: "column", gap: 2.25, pt: 1 }}
        >
          {isSub ? (
            <TextField
              select
              label="Group"
              value={group ?? ""}
              disabled={busy}
              error={serverError?.fields.parent_id !== undefined}
              helperText={serverError?.fields.parent_id ?? (editing ? "Move it to another group" : " ")}
              onChange={(event) => setGroup(Number(event.target.value))}
            >
              {groups.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1.25 }}>
                    <CategoryIcon icon={option.icon} color={option.color} size={20} />
                    {option.name}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          ) : null}

          <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            <IconColorPicker
              icon={icon}
              color={color}
              disabled={busy}
              iconNames={CATEGORY_ICON_NAMES}
              renderIcon={(iconName, iconColor, size) => <CategoryIcon icon={iconName} color={iconColor} size={size} />}
              onChange={(nextIcon, nextColor) => {
                setIcon(nextIcon);
                setColor(nextColor);
              }}
            />
            <TextField
              label={isSub ? "Sub-category Name" : "Category Name"}
              value={name}
              disabled={busy}
              autoFocus
              error={serverError?.fields.name !== undefined}
              helperText={serverError?.fields.name}
              onChange={(event) => setName(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 64, autoComplete: "off" } }}
              sx={{ flex: 1 }}
            />
          </Box>

          {!isSub && !editing ? (
            <Typography variant="body2" color="text.secondary">
              A category with sub-categories is a group: transactions go in its sub-categories. Without any, it is
              used on its own.
            </Typography>
          ) : null}

          {editing ? (
            <FormControlLabel
              control={<Switch checked={visible} disabled={busy} onChange={(event) => setVisible(event.target.checked)} />}
              label={isSub ? "Offer it for new transactions" : "Offer it and its sub-categories for new transactions"}
            />
          ) : null}

          {serverError && Object.keys(serverError.fields).length === 0 ? (
            <Typography color="error" variant="body2">
              {errorMessage(serverError)}
            </Typography>
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" color="inherit" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="category-form" disabled={!canSave}>
          {editing ? "Save" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
