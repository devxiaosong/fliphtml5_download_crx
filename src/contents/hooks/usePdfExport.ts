import { useState, useCallback } from "react"
import { message } from "antd"
import { generatePDF, downloadPDF } from "../../utils/pdfGenerator"
import type { PDFOrientation } from "../../utils/pdfGenerator"
import { logInfo } from "../../core/misc"

export interface PdfProgressState {
  currentFile: number
  totalFiles: number
  currentPage: number
  totalPages: number
  message: string
}

interface UsePdfExportParams {
  imageState: { normalImages: string[]; totalPages: number }
  metaInfo: { title: string; pageWidth?: number; pageHeight?: number } | null
  getHomepage: () => string | undefined
}

function computeAutoPageSize(
  pageWidth: number,
  pageHeight: number
): { width: number; height: number } {
  const A4_SHORT = 595
  const A4_LONG = 842
  const isLandscape = pageWidth > pageHeight
  const containerW = isLandscape ? A4_LONG : A4_SHORT
  const containerH = isLandscape ? A4_SHORT : A4_LONG
  const scale = Math.min(containerW / pageWidth, containerH / pageHeight)
  return {
    width: Math.round(pageWidth * scale),
    height: Math.round(pageHeight * scale)
  }
}

function generatePdfFileName(
  title: string,
  orientation: PDFOrientation | "auto",
  partNumber?: number
): string {
  try {
    let safeTitle = title || "no title"
    safeTitle = safeTitle.replace(/[<>:"/\\|?*]/g, "_")
    safeTitle = safeTitle.replace(/\s+/g, " ").trim()
    const maxLength = 100
    if (safeTitle.length > maxLength) {
      safeTitle = safeTitle.slice(0, maxLength)
    }
    const now = new Date()
    const timestamp = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}_${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`
    const partSuffix = partNumber !== undefined ? `-part${partNumber}` : ""
    return `${safeTitle}-${orientation}-${timestamp}${partSuffix}.pdf`
  } catch {
    const now = new Date()
    const timestamp = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}_${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`
    const partSuffix = partNumber !== undefined ? `-part${partNumber}` : ""
    return `no_title-${orientation}-${timestamp}${partSuffix}.pdf`
  }
}

export function usePdfExport({
  imageState,
  metaInfo,
  getHomepage
}: UsePdfExportParams) {
  const [splitMode, setSplitMode] = useState<"all" | "custom">("all")
  const [pagesPerFile, setPagesPerFile] = useState<number>(150)
  const [imageQuality, setImageQuality] = useState<number>(0.92)
  const [exportMode, setExportMode] = useState<"all" | "range" | "selected">("all")
  const [exportRange, setExportRange] = useState<{ start: number; end: number }>({
    start: 1,
    end: 1
  })
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const [downloading, setDownloading] = useState(false)
  const [pdfProgress, setPdfProgress] = useState<PdfProgressState | null>(null)

  const handleDownloadPDF = useCallback(
    async (orientation: PDFOrientation | "auto" = "portrait") => {
      const currentUrl = window.location.href
      const allImages = imageState.normalImages

      if (allImages.length === 0) {
        message.error("No images to download.")
        return
      }

      let filteredImages: string[] = []

      switch (exportMode) {
        case "all":
          filteredImages = [...allImages]
          break
        case "range": {
          const start = Math.max(1, exportRange.start) - 1
          const end = Math.min(exportRange.end, allImages.length)
          if (exportRange.start > exportRange.end || start >= allImages.length) {
            message.error("Invalid range. Please check your input.")
            return
          }
          filteredImages = allImages.slice(start, end)
          break
        }
        case "selected":
          if (selectedPages.size === 0) {
            message.error("Please select at least one page.")
            return
          }
          const sortedIndices = Array.from(selectedPages).sort((a, b) => a - b)
          filteredImages = sortedIndices
            .map((index) => allImages[index])
            .filter(Boolean)
          break
      }

      if (filteredImages.length === 0) {
        message.error("No images match your selection.")
        return
      }

      logInfo(
        "handle_download_pdf",
        `Starting PDF download (exportMode: ${exportMode}, splitMode: ${splitMode}, orientation: ${orientation}, totalImages: ${filteredImages.length}, pagesPerFile: ${pagesPerFile}) | URL: ${currentUrl}`
      )

      const homepage = getHomepage()

      const resolvedOrientation: PDFOrientation =
        orientation === "auto" ? "portrait" : orientation
      const customPageSize =
        orientation === "auto" &&
        metaInfo?.pageWidth &&
        metaInfo?.pageHeight
          ? computeAutoPageSize(metaInfo.pageWidth, metaInfo.pageHeight)
          : undefined

      setDownloading(true)

      try {
        const title = metaInfo?.title ?? "no title"

        if (
          splitMode === "custom" &&
          pagesPerFile > 0 &&
          filteredImages.length > pagesPerFile
        ) {
          const totalFiles = Math.ceil(filteredImages.length / pagesPerFile)

          for (let i = 0; i < totalFiles; i++) {
            const startIdx = i * pagesPerFile
            const endIdx = Math.min(startIdx + pagesPerFile, filteredImages.length)
            const batchImages = filteredImages.slice(startIdx, endIdx)

            setPdfProgress({
              currentFile: i + 1,
              totalFiles,
              currentPage: 0,
              totalPages: batchImages.length,
              message: `Generating file ${i + 1}/${totalFiles}...`
            })

            const fileName = generatePdfFileName(title, orientation, i + 1)
            const pdf = await generatePDF(batchImages, {
              orientation: resolvedOrientation,
              customPageSize,
              addWatermark: true,
              homepage,
              imageQuality,
              onProgress: (current, total) => {
                setPdfProgress({
                  currentFile: i + 1,
                  totalFiles,
                  currentPage: current,
                  totalPages: total,
                  message: `File ${i + 1}/${totalFiles}: Processing page ${current}/${total}`
                })
              }
            })

            downloadPDF(pdf, fileName)
            if (i < totalFiles - 1) {
              await new Promise((resolve) => setTimeout(resolve, 300))
            }
          }

          setPdfProgress(null)
          message.success(`Successfully downloaded ${totalFiles} PDF files!`)
          logInfo(
            "end_download",
            `PDF downloaded successfully (${totalFiles} files, ${filteredImages.length} images total) | URL: ${currentUrl}`
          )
        } else {
          setPdfProgress({
            currentFile: 1,
            totalFiles: 1,
            currentPage: 0,
            totalPages: filteredImages.length,
            message: "Generating PDF..."
          })

          const fileName = generatePdfFileName(title, orientation)
          const pdf = await generatePDF(filteredImages, {
            orientation: resolvedOrientation,
            customPageSize,
            addWatermark: true,
            homepage,
            imageQuality,
            onProgress: (current, total) => {
              setPdfProgress({
                currentFile: 1,
                totalFiles: 1,
                currentPage: current,
                totalPages: total,
                message: `Processing page ${current}/${total}`
              })
            }
          })

          downloadPDF(pdf, fileName)
          setPdfProgress(null)
          message.success("PDF downloaded successfully!")
          logInfo(
            "end_download",
            `PDF downloaded successfully (1 file, ${filteredImages.length} images) | URL: ${currentUrl}`
          )
        }
      } catch (error) {
        setPdfProgress(null)
        message.error("Failed to generate PDF")
        logInfo(
          "download_error",
          `Failed to generate PDF: ${error} | URL: ${currentUrl}`
        )
      } finally {
        setDownloading(false)
      }
    },
    [
      imageState.normalImages,
      exportMode,
      exportRange,
      selectedPages,
      splitMode,
      pagesPerFile,
      imageQuality,
      metaInfo?.title,
      getHomepage
    ]
  )

  return {
    splitMode,
    setSplitMode,
    pagesPerFile,
    setPagesPerFile,
    imageQuality,
    setImageQuality,
    exportMode,
    setExportMode,
    exportRange,
    setExportRange,
    selectedPages,
    setSelectedPages,
    downloading,
    pdfProgress,
    handleDownloadPDF
  }
}
