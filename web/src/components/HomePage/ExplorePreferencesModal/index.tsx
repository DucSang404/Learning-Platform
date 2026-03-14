import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

import CustomButton from '@/components/common/Button'
import MultiSelectSearch, { type MultiSelectOption } from '@/components/common/MultiSelectSearch'
import { Input } from '@/components/ui/input'
import useLockBodyScroll from '@/hooks/useLockBodyScroll'
import categoryService from '@/services/course/category.service'
import eventTracker from '@/services/personalize/eventTracker'
import tagsService from '@/services/course/tags.service'

export type ExplorePreferencesPayload = {
  categories: string[]
  tags: string[]
  keywords: string[]
}

const MAX_SELECTIONS_PER_SECTION = 3
const MAX_VISIBLE_CATEGORIES = 6
const CATEGORY_ICONS = ['💻', '📊', '🤖', '🌐', '⚙️', '☁️']

function parseKeywords(raw: string): string[] {
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
}

type CategoryOption = MultiSelectOption & { description: string }

function mapCategoriesToOptions(categories: { id: string; name: string; description: string }[]): CategoryOption[] {
  return categories.slice(0, MAX_VISIBLE_CATEGORIES).map((category) => ({
    value: category.id,
    label: category.name,
    description: category.description || 'Khám phá thêm nội dung phù hợp với sở thích của bạn.'
  }))
}

function mapTagsToOptions(tags: { id: string; name: string }[]): MultiSelectOption[] {
  return tags.map((tag) => ({
    value: tag.id,
    label: tag.name
  }))
}

export default function ExplorePreferencesModal({
  open,
  onOpenChange,
  onSave
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: (payload: ExplorePreferencesPayload) => void
}) {
  useLockBodyScroll(open)

  const initialCachedTagOptions = useMemo(() => {
    const cachedResponse = tagsService.getCachedAllTags()
    const cachedTags = cachedResponse?.result ?? cachedResponse?.data ?? []
    return mapTagsToOptions(cachedTags)
  }, [])

  const [categories, setCategories] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [keywordText, setKeywordText] = useState('')
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([])
  const [tagOptions, setTagOptions] = useState<MultiSelectOption[]>(initialCachedTagOptions)
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [isLoadingTags, setIsLoadingTags] = useState(initialCachedTagOptions.length === 0)
  const [isSaving, setIsSaving] = useState(false)
  const [categoryError, setCategoryError] = useState('')
  const [tagError, setTagError] = useState('')
  const [keywordError, setKeywordError] = useState('')

  const categoryLabelByValue = useMemo(
    () => new Map(categoryOptions.map((option) => [option.value, option.label])),
    [categoryOptions]
  )
  const tagLabelByValue = useMemo(() => new Map(tagOptions.map((option) => [option.value, option.label])), [tagOptions])

  useEffect(() => {
    let isCancelled = false

    const fetchCategories = async () => {
      setIsLoadingCategories(true)

      try {
        const response = await categoryService.getAllCategories()
        const nextCategoryOptions = mapCategoriesToOptions(response?.result ?? response?.data ?? [])

        if (!isCancelled) {
          setCategoryOptions(nextCategoryOptions)
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingCategories(false)
        }
      }
    }

    const fetchTags = async () => {
      const cachedResponse = tagsService.getCachedAllTags()
      const cachedTags = cachedResponse?.result ?? cachedResponse?.data ?? []

      if (cachedTags.length > 0) {
        setTagOptions(mapTagsToOptions(cachedTags))
        setIsLoadingTags(false)
        return
      }

      setIsLoadingTags(true)

      try {
        const response = await tagsService.getAllTags()
        const nextTagOptions = mapTagsToOptions(response?.result ?? response?.data ?? [])

        if (!isCancelled) {
          setTagOptions(nextTagOptions)
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingTags(false)
        }
      }
    }

    void fetchCategories()
    void fetchTags()

    return () => {
      isCancelled = true
    }
  }, [])

  const toggleCategory = useCallback((value: string) => {
    setCategories((prev) => {
      if (prev.includes(value)) {
        setCategoryError('')
        return prev.filter((item) => item !== value)
      }

      if (prev.length >= MAX_SELECTIONS_PER_SECTION) {
        setCategoryError(`Bạn chỉ có thể chọn tối đa ${MAX_SELECTIONS_PER_SECTION} danh mục.`)
        return prev
      }

      setCategoryError('')
      return [...prev, value]
    })
  }, [])

  const handleTagsChange = useCallback((nextTags: string[]) => {
    if (nextTags.length > MAX_SELECTIONS_PER_SECTION) {
      setTagError(`Bạn chỉ có thể chọn tối đa ${MAX_SELECTIONS_PER_SECTION} công nghệ.`)
      return
    }

    setTagError('')
    setTags(nextTags)
  }, [])

  const isTagOptionDisabled = useCallback(
    (option: MultiSelectOption) => tags.length >= MAX_SELECTIONS_PER_SECTION && !tags.includes(option.value),
    [tags]
  )

  const handleKeywordTextChange = useCallback((nextKeywordText: string) => {
    const nextKeywords = parseKeywords(nextKeywordText)

    if (nextKeywords.length > MAX_SELECTIONS_PER_SECTION) {
      setKeywordError(`Bạn chỉ có thể nhập tối đa ${MAX_SELECTIONS_PER_SECTION} từ khóa.`)
      return
    }

    setKeywordError('')
    setKeywordText(nextKeywordText)
  }, [])

  const parsedKeywords = useMemo(() => parseKeywords(keywordText), [keywordText])

  // All selected items for the summary bar
  const allSelections = useMemo(() => {
    const items: { key: string; label: string; type: 'category' | 'tag' | 'keyword'; value: string }[] = []
    categories.forEach((v) =>
      items.push({ key: `cat-${v}`, label: categoryLabelByValue.get(v) ?? v, type: 'category', value: v })
    )
    tags.forEach((v) => items.push({ key: `tag-${v}`, label: tagLabelByValue.get(v) ?? v, type: 'tag', value: v }))
    parsedKeywords.forEach((k) => items.push({ key: `kw-${k}`, label: k, type: 'keyword', value: k }))
    return items
  }, [categories, tags, parsedKeywords, categoryLabelByValue, tagLabelByValue])

  const removeSelection = useCallback(
    (item: { label: string; type: 'category' | 'tag' | 'keyword'; value: string }) => {
      if (item.type === 'category') {
        setCategoryError('')
        setCategories((prev) => prev.filter((value) => value !== item.value))
      } else if (item.type === 'tag') {
        setTagError('')
        setTags((prev) => prev.filter((value) => value !== item.value))
      } else {
        setKeywordError('')
        const remaining = parsedKeywords.filter((k) => k !== item.label)
        setKeywordText(remaining.join(', '))
      }
    },
    [parsedKeywords]
  )

  const handleClearAll = useCallback(() => {
    setCategories([])
    setTags([])
    setKeywordText('')
    setCategoryError('')
    setTagError('')
    setKeywordError('')
  }, [])

  const handleSave = useCallback(async () => {
    if (isSaving) return

    setIsSaving(true)

    try {
      await eventTracker.trackingEvent('EXPLORE_PREFERENCES', {
        category: categories.map((v) => categoryLabelByValue.get(v) ?? v).join(', '),
        tag: tags.map((v) => tagLabelByValue.get(v) ?? v).join(', '),
        longDes: parsedKeywords.join(', ')
      })
    } catch {
      // still continue to close and refresh; backend can be retried on next interaction
    }

    const payload: ExplorePreferencesPayload = {
      categories: categories.map((v) => categoryLabelByValue.get(v) ?? v),
      tags: tags.map((v) => tagLabelByValue.get(v) ?? v),
      keywords: parsedKeywords
    }
    onSave?.(payload)
    onOpenChange(false)
    setIsSaving(false)
  }, [categories, categoryLabelByValue, isSaving, parsedKeywords, onOpenChange, onSave, tagLabelByValue, tags])

  const isSaveDisabled = allSelections.length === 0 || isSaving

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild>
              <motion.div
                className='fixed inset-0 z-50 bg-black/60 backdrop-blur-sm'
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </DialogPrimitive.Overlay>

            <DialogPrimitive.Content asChild>
              <motion.div
                className='fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6'
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className='relative flex w-full max-w-[800px] max-h-[90vh] flex-col rounded-2xl bg-modal-base shadow-2xl shadow-black/40 border border-modal-border overflow-hidden'
                  initial={{ scale: 0.95, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 20 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                >
                  {/* Close button */}
                  <button
                    onClick={() => onOpenChange(false)}
                    className='absolute right-4 top-4 z-10 rounded-lg p-2 text-modal-text-low transition-colors hover:bg-modal-surface hover:text-modal-text-high'
                  >
                    <X className='h-5 w-5 text-red-600' />
                  </button>

                  {/* Header */}
                  <div className='px-8 pt-8 pb-2 text-white'>
                    <DialogPrimitive.Title className='font-heading text-2xl font-semibold text-modal-text-high'>
                      Khám phá khóa học phù hợp với bạn
                    </DialogPrimitive.Title>
                  </div>

                  {/* Scrollable content */}
                  <div className='flex-1 overflow-y-auto px-8 py-6 space-y-12 text-white'>
                    {/* Categories - Large clickable cards */}
                    <section>
                      <h3 className='font-heading text-lg font-semibold text-modal-text-high mb-1'>
                        Danh mục quan tâm
                      </h3>
                      <p className='font-body text-sm text-modal-text-low mb-6'>
                        Chọn các lĩnh vực bạn muốn ưu tiên để hệ thống gợi ý lộ trình học tập phù hợp.
                      </p>

                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                        {categoryOptions.map((option, index) => {
                          const selected = categories.includes(option.value)
                          const categoryClassName = selected
                            ? 'border-emerald-400 bg-blue-400 shadow-sm'
                            : 'border-modal-border bg-modal-surface hover:bg-modal-surface-hover hover:border-modal-text-low/30'

                          return (
                            <motion.button
                              key={option.value}
                              type='button'
                              onClick={() => toggleCategory(option.value)}
                              whileTap={{ scale: 0.98 }}
                              disabled={isLoadingCategories}
                              className={`relative flex items-start gap-4 rounded-xl border p-4 text-left transition-all duration-200 ${categoryClassName}`}
                            >
                              <span className='text-2xl mt-0.5'>{CATEGORY_ICONS[index % CATEGORY_ICONS.length]}</span>

                              <div className='flex-1 min-w-0'>
                                <span className='font-heading text-sm font-medium text-modal-text-high block'>
                                  {option.label}
                                </span>

                                <span className='font-body text-xs text-modal-text-low mt-1 block leading-relaxed'>
                                  {option.description}
                                </span>
                              </div>
                            </motion.button>
                          )
                        })}
                      </div>

                      {isLoadingCategories && (
                        <p className='mt-3 text-sm font-body text-modal-text-low'>Đang tải danh mục...</p>
                      )}

                      {categoryError && <p className='mt-3 text-sm font-body text-red-400'>{categoryError}</p>}
                    </section>

                    {/* Tags */}
                    <section>
                      <h3 className='font-heading text-lg font-semibold text-modal-text-high mb-1'>
                        Công nghệ muốn học
                      </h3>
                      <p className='font-body text-sm text-modal-text-low mb-6'>
                        Chọn một hoặc nhiều công nghệ để tinh chỉnh gợi ý khóa học theo nhu cầu của bạn.
                      </p>
                      <MultiSelectSearch
                        options={tagOptions}
                        value={tags}
                        onChange={handleTagsChange}
                        isOptionDisabled={isTagOptionDisabled}
                        placeholder={isLoadingTags ? 'Đang tải công nghệ...' : 'Chọn công nghệ...'}
                        searchPlaceholder='Tìm công nghệ...'
                        emptyText={isLoadingTags ? 'Đang tải dữ liệu...' : 'Không tìm thấy công nghệ.'}
                        disabled={isLoadingTags}
                      />
                      {tagError && <p className='mt-3 text-sm font-body text-red-400'>{tagError}</p>}
                    </section>

                    {/* Keywords */}
                    <section>
                      <h3 className='font-heading text-lg font-semibold text-modal-text-high mb-1'>
                        Từ khóa tập trung
                      </h3>
                      <p className='font-body text-sm text-modal-text-low mb-6'>
                        Nhập các chủ đề cụ thể bạn muốn học sâu hơn.
                      </p>
                      <Input
                        value={keywordText}
                        onChange={(e) => handleKeywordTextChange(e.target.value)}
                        placeholder='Ví dụ: backend, machine learning, microservices...'
                        className='h-12 rounded-xl border-modal-border bg-modal-surface px-4 text-sm font-body text-black placeholder:text-modal-text-low focus-visible:border-modal-accent focus-visible:ring-modal-accent/30'
                      />
                      <p className='mt-2 font-body text-xs text-modal-text-low'>
                        Phân tách nhiều từ khóa bằng dấu phẩy.
                      </p>
                      {keywordError && <p className='mt-2 text-sm font-body text-red-400'>{keywordError}</p>}
                    </section>
                  </div>

                  {/* Sticky summary bar + actions */}
                  <div className='border-t border-modal-border bg-modal-base/95 backdrop-blur-sm px-8 py-4 space-y-3'>
                    {allSelections.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className='overflow-hidden'
                      >
                        <div className='flex items-center gap-2 flex-wrap'>
                          <span className='font-body text-sm font-bold text-modal-text-low shrink-0 flex items-center'>
                            <Sparkles className='inline h-3.5 w-3.5 mr-1 text-emerald-400' />
                            <span className='bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent'>
                              Lộ trình cho:
                            </span>
                          </span>
                          <AnimatePresence mode='popLayout'>
                            {allSelections.map((item) => (
                              <motion.span
                                key={item.key}
                                layout
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                className='
                                        inline-flex items-center gap-1
                                        rounded-full px-3 py-1
                                        text-sm font-medium text-white

                                        bg-gradient-to-r from-emerald-400/10 via-cyan-400/60 to-blue-400
                                        border border-emerald-400/20

                                        bg-gradient-to-r from-emerald-500 to-blue-500

                                        backdrop-blur-sm
                                        shadow-sm

                                        hover:shadow-[0_0_12px_rgba(16,185,129,0.35)]
                                        hover:border-emerald-400/40
                                        '
                              >
                                {item.label}
                                <button
                                  type='button'
                                  onClick={() => removeSelection(item)}
                                  className='rounded-full p-0.5 transition-colors hover:bg-modal-accent/25'
                                >
                                  <X className='h-3 w-3' />
                                </button>
                              </motion.span>
                            ))}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}

                    <div className='flex items-center justify-end gap-3'>
                      <button
                        type='button'
                        onClick={handleClearAll}
                        className='rounded-xl border-modal-border bg-modal-surface px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-modal-surface-hover hover:text-yellow-300'
                      >
                        Gỡ hết lựa chọn
                      </button>
                      <CustomButton
                        variant='modal-ghost'
                        className='text-white hover:text-red-600'
                        label='Hủy'
                        onClick={() => onOpenChange(false)}
                      />
                      <CustomButton
                        variant='modal-primary'
                        className='text-white hover:text-green-500'
                        label='Lưu sở thích'
                        onClick={handleSave}
                        disabled={isSaveDisabled}
                        isLoader={isSaving}
                      />
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}
